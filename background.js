//highest level controller
//tabs and browser message handling
var InitComptroller = function(){
    var comptroller = {};
    //manager manages the subreddit folders
    comptroller.manager = InitSubredditFolderManager();


    //queries for the currently active tab
    comptroller.gettingCurrentTab = function(){
        return browser.tabs.query({
            currentWindow: true,
            active: true
        }).then(tabs => { return tabs[0];});
    };


    //converses with given tab to retrieve current subreddit
    comptroller.gettingCurrentSubredditsOfTab = function(tab){
        return browser.tabs.sendMessage(tab.id, {request: 'current_subreddits'}).then(response => {
            if (response.current_subreddits){
                return response.current_subreddits;
            }
        });
    };

    //message listener controller
    //you can either return info by sendmessage or by returning a promise that returns some info
    //NOTE: error checking is done client side before seding a message through.
    //both actions and requests return stuff. it's turned out not to be as helpful a distinction as i thought
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action){
            //remove subreddits from a specific folder
            if (message.action === 'remove_subreddits' && message.folder_id && message.subreddits){
                //removeSubreddits doesnt actually change anything- just returns a hypothetical array
                comptroller.manager.removeSubreddits(message.folder_id, message.subreddits);
                var saving = comptroller.manager.savingAllFoldersToDisk();
                return saving.then(() => {
                    return {subreddits: comptroller.manager.getSubreddits(message.folder_id)};
                });
            }

            // add subreddits to a specific folder
            if (message.action === 'add_subreddits' && message.folder_id && message.subreddits){
                comptroller.manager.addSubreddits(message.folder_id, message.subreddits);
                var saving = comptroller.manager.savingAllFoldersToDisk();
                return saving.then(() => {
                   return {subreddits: comptroller.manager.getSubreddits(message.folder_id)};
                });
            }

            // add subreddit folder
            if (message.action === 'add_folder' && message.folder_id && message.subreddits){                
                comptroller.manager.addFolder(message.folder_id, message.subreddits);
                var saving = comptroller.manager.savingAllFoldersToDisk();
                return saving.then(() => {
                    return {subreddits: comptroller.manager.getSubreddits(message.folder_id)};
                });
            }

            // add subreddit folder
            if (message.action === 'remove_folder' && message.folder_id){                
                comptroller.manager.removeFolder(message.folder_id, message.subreddits);
                return comptroller.manager.savingAllFoldersToDisk();
            }

        } else if (message.request){
            //for testing purposes
            if (message.request === 'console'){
                console.log(message.message);
            }

            //return all subreddit folder ids
            if (message.request === 'folders'){
                sendResponse({folders: comptroller.manager.getFolderIdArray()});
            }

            //return the array of subreddits belonging to a specific subredit folder
            if (message.request === 'folder_subreddits'&& message.folder_id){
                sendResponse({folder_subreddits: comptroller.manager.getSubreddits(message.folder_id)});
            }

            // returns info to check whether toggle chould be disabled and, if not, whether ti should
            // be + or -. 
            if (message.request === 'toggle_permission' && message.folder_id){
                //if not reddit domain, return a rejected promise
                return comptroller.gettingCurrentTab().then(tab => {
                    //rejection travels through the chains if url is not reddit domain
                    if (!tab.url.startsWith(comptroller.manager.baseString)){
                        return new Promise.reject("active tab is not of reddit domain");
                    } else {
                        return tab;
                    }
                //if the current page is already included, the button should be [-] and remove it on click
                }).then(comptroller.gettingCurrentSubredditsOfTab)
                  .then(currentSubreddits => {
                    return {                     //this is why you can't remove by toggle button if multi
                            subreddit_included:  currentSubreddits.length == 1 
                                                 && comptroller.manager.areSubredditsIncluded(message.folder_id, 
                                                                                              [currentSubreddits[0]]),
                            subreddits: currentSubreddits
                    };
                });
            }
        }
    });

    return comptroller;

};




//manager and id become immutable. the id is the name of the folder
//so on rename you'll have to create a new folder
//this is because the sets are stored by their id.
//should only be called by manager
//call this when you're loading in a subreddit from disk- don't just fill in id and subreddits
//otherwise you won't get the functions
//makes a copy of the subreddits so you don't have to worry about that higher up the chain
var SubredditFolderFactory = function(subredditFolderManager, id, initalSubreddits){
    if (!initalSubreddits){
        initalSubreddits = [];
    }

    var subredditFolder = {};
    subredditFolder.subreddits = initalSubreddits.filter(elem => true).sort();

    //immutable properties
    Object.defineProperty(subredditFolder, 'manager', {
        value: subredditFolderManager,
    });
    Object.defineProperty(subredditFolder, 'id', {
        value: id,
        enumerable: true
    });

    

    //takes an array of subreddit names, returns whether any currently included in array
    subredditFolder.areSubredditsIncluded = function(subreddits){
        var areIncluded = fase;
        for (var i = 0; i != subreddits.length; ++i){
            if (this.subreddits.indexOf(subreddits[i]) != -1){
                areIncluded = true;
                break;
            }
        }
        return areIncluded;
    };

    //returns the new sorted subreddits array
    //assumes max of one instance of subredditName
    subredditFolder.removeSubreddits = function(subredditNames){
        //copies array, filtering out the removed ones
        var temp = this.subreddits.filter(subreddit => subredditNames.indexOf(subreddit) == -1);
        this.subreddits = temp.sort();
        return this.subreddits
    }
    //won't add an extra one if entry already exists
    subredditFolder.addSubreddits = function(subredditNames){
        //copies the array
        var temp = this.subreddits.filter(elem => true);
        //add names if necessary
        for(var i = 0; i != subredditNames.length; ++i){
            var index = temp.indexOf(subredditNames[i]);
            if (index === -1) {
                temp.push(subredditNames[i]);
            }
        }
        this.subreddits = temp.sort();
        return this.subreddits;
    }

    //makes and returns the full url of the folder's front page
    subredditFolder.getFullURL = function(){
        return this.manager.baseString + this.subreddits.join('+');
    }

    return subredditFolder;
};

//called once by comptroller to create a singleton manager
var InitSubredditFolderManager = function(){
    var manager = {};
    manager.baseString = 'https://www.reddit.com/r/';
    //this gets filled in at the end from disk
    manager.folders = {};

    manager.getNumberOfFolders = function(){
        return Object.keys(this.folders).length;
    };

    manager.getFolderIdArray = function(){
        return Object.keys(this.folders);
    };

    //checks folder id for uniqueness
    manager.isUniqueId = function(id){
        return manager.getFolderIdArray().indexOf(id) === -1;
    };


    //creates and adds a new subreddit folder
    //uses SubredditFolderFactory because it needs the functions too
    //does not save to disk
    //returns the folder object
    manager.addFolder = function(id, initalSubreddits){
        //check args
        if (!id){
            throw "argument: 'id' required";
        }
        if (!manager.isUniqueId(id)){
            throw "id must be unique";
        }
        if (!initalSubreddits){
            initalSubreddits = [];
        }
        
        this.folders[id] = SubredditFolderFactory(this, id, initalSubreddits);
        return this.folders[id];
    };

    //does not save to disk
    //returns true on successful deletion 
    //(ie the return of delete operator)
    manager.removeFolder = function(id){
        //check args
        if (!id){
            throw "argument: 'id' required";
        }
        return delete this.folders[id];
    };

    //get subreddits of a specific folder
    manager.getSubreddits = function(folderId){
        return this.getFolderById(folderId).subreddits;
    };
    //returns a specific folder object 
    manager.getFolderById = function(id){
        return this.folders[id];
    };

    //adds subreddits to a folder
    manager.addSubreddits = function(folderId, subredditNames){
        var folder = this.getFolderById(folderId);
        return folder.addSubreddits(subredditNames);
    }
    manager.removeSubreddits = function(folderId, subredditNames){
        var folder = this.getFolderById(folderId);
        return folder.removeSubreddits(subredditNames);
    }
    
    manager.areSubredditsIncluded = function(folderId, subreddits){
        return this.getFolderById(folderId).areSubredditsIncluded(subreddits);

    }

    //called to load in all the subreddits
    manager.initAllFoldersFromDisk = function(){
        return browser.storage.local.get('manager_set_dict').then((response) => {
            var dict = {};
            if (response.manager_set_dict){
                dict = response.manager_set_dict;
            }
            Object.keys(dict).forEach(id => {
                console.log(id +' : ' + dict[id]);
                manager.folders[id] = SubredditFolderFactory(this, id, dict[id]);
            });
            return manager.folders;
        });
    }

    //saves out all folders to disk
    manager.savingAllFoldersToDisk = function(){
        //we just need the id->subreddits info, not the functions etc
        var dict = {};
        Object.keys(this.folders).forEach(id => {
            dict[id] = this.folders[id].subreddits;
        });
        console.log(dict);
        return browser.storage.local.set({'manager_set_dict': dict});
        
    };

    //called to update a specific folder's subreddit list. 
    //NOTE: assumes the folder is already a legit object gotten by SubredditFolderFactory
    //      if you need to load folders in, use initAllFoldersFromDisk
    //returns the url to the front page of the folder
    manager.updatingFolderFromDisk = function(folderId){
        var folder = this.getFolderById(folderId);
        return browser.storage.local.get('manager_set_dict').then((response) => {
            var dict = {};
            if (response.manager_set_dict){
                dict = response.manager_set_dict;
            }
            if (dict[folder.id]){
                folder.subreddits = dict[folder.id];
            }
            return folder.getFullURL();
        });
    };

    //this is async, but should be done before popup is clicked on
    manager.initAllFoldersFromDisk();
    return manager;
};


var comptroller = InitComptroller();



//***********example of javascript fetching from reddit api****************//
// fetch('https://www.reddit.com/r/dataisbeautiful/.json?limit=5').then(response => {
//     return response.json();

// }).then(json => {
//     console.log(json.data.children[0].data.title);
// }); 