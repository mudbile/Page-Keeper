//idea - get authors of content and go through them to other subreddits


//working on the generator. it works for serendipitous subreddits. now we need to work on
// getting the seed search ones, joining them and returning them. use same recursion tactic as in serendip

//also todo- store active selection in bg
//          - lotta duplicates showing up
//          - you'll get duplicates if a subreddit is in both groups
//          -add weighting and stuff for comments search- exactly the same as subreddit seed search but use
//              response.data.children[i].data.subreddit instead of response.data.children[i].data.display_name
//          -make generator work when no active id (ie no folders yet)
//          -go through and provide failure functions for promises (particularly high-level gui stuff)
//          - settings page

var randomGenerator = (function() {
    //https://www.reddit.com/search.json?q=<seed>&sort=relevance&type=sr/')); but get after random count
    
    var generator = {
        //weights are used to calculate how many of each to get - if total is 10 and one is 30 and the other 70, 
        //then one will get 3 and the other 10
        weights : {
            serendipity : null,
            seed : null
        },
        numToGet : {
            total : null,
            serendipity : null,
            seed : null
        },
        //seed word/phrase
        seed : null,
        //list of subreddit names to exclude from results
        excludeList : null,
        //number of pages to grab for the seed search- dictates the size of the pool
        num_seed_search_pages_to_get: null,
        //can be 'relevance', 'new', 'top', etc.
        seed_sort_by: null
    };

    //gets the local values (that the user will store on the settings page)
    generator.initialisingValues = function(seed){
        //local.get accepts an object that provdes default values if property isn't found
        var defaultValues = {
            total_to_get: 100,
            serendipity_weight: 1,
            seed_weight: 0,
            num_seed_search_pages_to_get: 4,
            seed_sort_by: 'relevance',
            exclude_list: ['The_Donald']
        }
        return browser.storage.local.get(defaultValues).then(response => {
            generator.weights.serendipity = response.serendipity_weight;
            generator.weights.seed = response.seed_weight;
            generator.numToGet.total = response.total_to_get;
            //calculates numbers to get from relative weights
            generator.numToGet.seed = Math.floor(response.total_to_get * (response.seed_weight / 
                                            (response.serendipity_weight + response.seed_weight)));
            generator.numToGet.serendipity = generator.numToGet.total - generator.numToGet.seed;
            generator.seed = seed;
            generator.excludeList = response.exclude_list;
            generator.numSeedSearchPagesToGet = response.num_seed_search_pages_to_get;
            generator.seedSortBy = response.seed_sort_by;
        });
    }

    //call this from outside object
    //whill call for serendipitous subreddits and seed subreddits async, then adds them together
    generator.generatingRandomFolder = function(seed){
        return generator.initialisingValues().then(() => {
            var promises = new Array(2);
            //get both sets async
            promises[0] = generator.gettingSerendipitySubreddits(generator.numToGet.serendipity);
            promises[1] = generator.gettingSeededSubreddits(generator.numToGet.seed, seed);
            //return them all as one array
            return Promise.all(promises).then(groups => {return groups[0].concat(groups[1]);})
        })
    };

    //returns an array of as many subreddit names as it can, given the seed results and the
    //value of generator.numSeedSearchPagesToGet
    generator.gettingSeedNamesFromReddit = function(seed){
        var url = 'https://www.reddit.com/search.json?q='+seed+'&sort='+generator.seedSortBy+'&type=sr';
        //set initial values for the object, which will pass through the chain sequentially
        var waitChain = Promise.resolve({possibilities: [], after: ''});
        //attach links to the chain
        for (var i = 0; i !== generator.numSeedSearchPagesToGet; ++i){
            waitChain = waitChain.then(previousLinkResult => {
                //a link will make the previousLinkResult.after property null
                //if there are no more pages to get OR something's wrong wih the json
                if (previousLinkResult.after === null){
                    console.log('skipping link because ran out...');
                    return previousLinkResult;
                }
                var fullURL = url +'&after='+previousLinkResult.after;
                console.log(fullURL);
                //get the json...
                return generator.gettingRedditApiResponse(fullURL).then(response => {
                    //check data
                    var dataOkay = response && response.data 
                                && response.data.children;
                    if (dataOkay){
                        //fill in the promised data
                        response.data.children.forEach(child => {
                            previousLinkResult.possibilities.push(child.data.display_name);
                        })
                        //response.data.after is either null or gives the code for the 'after' url setting
                        previousLinkResult.after = response.data.after;
                    } else {
                        previousLinkResult.after = null;
                    }
                    //pass the result down the line
                    return previousLinkResult;
                });
            });
        }
        //extract the names- they're what you actually want
        return waitChain.then(lastLinkResult => {return lastLinkResult.possibilities;});
    }

    //randomly selects numToGet elements from an array of string possibilities
    //could use splice but it's not efficient for large arrays (or is it?)
    generator.chooseRandomElements = function(numToGet, possibilities){
        var subreddits = [];
        var chosenAlready = [];
        //while there's still some to get and you still want some...
        while(possibilities.length !== chosenAlready.length && subreddits.length !== numToGet){
            //get a random elememt
            var randIndex = Math.floor(Math.random() * possibilities.length);
            var chosen = possibilities[randIndex];
            //add it if it's good
            if (chosenAlready.indexOf(chosen) === -1 && generator.excludeList.indexOf(chosen) === -1){
                subreddits.push(chosen);
            }
            chosenAlready.push(chosen);
        }
        return subreddits;
    }

    //returns an array of promises for the seeded group of subreddits
    generator.gettingSeededSubreddits = function(numToGet, seed){
        if (numToGet === 0){
            return [];
        }
        //get and store first num_seed_search_pages_to_get pages of search results
        return generator.gettingSeedNamesFromReddit(seed).then(possibilities => {
            console.log(possibilities);
            return generator.chooseRandomElements(numToGet, possibilities);
        })

    }

    //returns a promised list of random subreddits similar to using the serendipity button on reddit
    generator.gettingSerendipitySubreddits = function(numToGet){
        if (numToGet === 0){
            return [];
        }
        //array is filled iwth promises that return a subreddit name
        var subredditPromises = new Array(numToGet);
        for (var i = 0; i != numToGet; ++i){              //this actually returns a random comment from a random sub
            subredditPromises[i] = generator.gettingRedditApiResponse('https://www.reddit.com/random/.json?&limit=1/')
                                            .then(response => {
                                                //check data
                                                var dataOkay = response && response[0] && response[0].data 
                                                    && response[0].data.children && response[0].data.children[0]
                                                    && response[0].data.children[0].data.subreddit;
                                                if (dataOkay){
                                                    //fill in the promised data
                                                    return response[0].data.children[0].data.subreddit;
                                                } else {
                                                    return Promise.reject('invalid json from api');
                                                }
                                            });
        }
        //now we need to ensure there are no duplicates and no excluded subreddits
        //but we still need to fill the quota, so there's recursion
        return Promise.all(subredditPromises).then(subreddits => {
            console.log('got: ');
            console.log(subreddits);
            var okaySubredits = generator.cleanSubredditArray(subreddits);
            console.log('after clean: ');
            console.log(okaySubredits);
            //the quota being filled is our base condition
            if (okaySubredits.length === numToGet){
                console.log('returning: ');
                console.log(okaySubredits);
                return okaySubredits;
            //otherwise concat the results of a recursive call asking 
            //for the number of subreddits still to get, and return that 
            } else {                
                var stillToGet = numToGet - okaySubredits.length;
                console.log('need ' +stillToGet+ ' more...');
                console.log(okaySubredits);
                return generator.gettingSerendipitySubreddits(stillToGet).then(moreSubreddits => {
                    console.log('returning concatenated: ');
                    console.log(generator.cleanSubredditArray(okaySubredits.concat(moreSubreddits)));
                    return generator.cleanSubredditArray(okaySubredits.concat(moreSubreddits));
                });
            }
        });
    }

    //returns new array with no duplicates and none that are in excludeList
    generator.cleanSubredditArray = function(subreddits){
        var okaySubreddits = [];
        for (var i = 0; i != subreddits.length; ++i){
            var checkingThisSubreddit = subreddits[i];
            if (generator.excludeList.indexOf(checkingThisSubreddit) === -1 
                &&     okaySubreddits.indexOf(checkingThisSubreddit) === -1){
                okaySubreddits.push(checkingThisSubreddit);
            }
        }
        return okaySubreddits;
    }

    //given an api url(e.g. https://www.reddit.com/api/multi/user/deltaprogress/m/artncomics/.json)
    //returns the decoded json object found there
    generator.gettingRedditApiResponse = function(apiURL){
        return fetch(apiURL).then(response => {
            return response.json();
        }); 
    };

    return generator;
})();

    































//highest level controller
//tabs and browser message handling
var InitComptroller = function(){
    var comptroller = {};
    //manager manages the subreddit folders
    comptroller.manager = InitSubredditFolderManager();

    //given a suitable multi url (eg https://www.reddit.com/user/deltaprogress/m/artncomics/)
    //returns a promised array of subreddit names- those that the multi contains
    comptroller.gettingMultiSubreddits = function(url){
        //create api url
        var base = 'https://www.reddit.com/';
        var api = 'api/multi/';
        var path = url.slice(url.indexOf('user/'));
        var apiURL = base + api + path + '.json';
        //get result
        return comptroller.gettingRedditApiResponse(apiURL).then(response => {
            var subredditNames = [];
            for (var i = 0; i != response.data.subreddits.length; ++i){
                subredditNames.push(response.data.subreddits[i].name);
            }
            return subredditNames;
        });
    };
    //given an api url(e.g. https://www.reddit.com/api/multi/user/deltaprogress/m/artncomics/.json)
    //returns the decoded json object found there
    comptroller.gettingRedditApiResponse = function(apiURL){
        return fetch(apiURL).then(response => {
            return response.json();
        }); 
    };





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


    comptroller.isURLValidForAddingSubreddits = function(url){
        return url.startsWith('https://www.reddit.com/');    
    }

    //message listener controller
    //you can either return info by sendresponse or by returning a promise that returns some info
    //NOTE: error checking is done client side before seding a message through.
    //both actions and requests return stuff. it's turned out not to be as helpful a distinction as i thought
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action){
            if (message.action === 'generate_random_folder' && message.seed){
                var getting = randomGenerator.generatingRandomFolder(message.seed);
                return getting.then(subreddits => {
                    return {subreddits: subreddits};
                })
                //console.log('here: ' + );
                //sendResponse({subreddits: randomGenerator.generateRandomFolder(currentSubreddits, message.seed)});
            }

            //note: this is used for the popup unload- this doesn't track the active id while the popup
            //is open
            if (message.action === 'store_active_id' && message.id){
                console.log('storing:' + message.id);
                comptroller.manager.storedActiveId = message.id;
            }

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
            }

            if (message.request === 'current_url'){
                return comptroller.gettingCurrentTab().then(tab => {
                    return ({current_url: tab.url});
                });
            }

            //go through reddit api
            if (message.request === 'multi_subreddits' && message.url){
                return comptroller.gettingMultiSubreddits(message.url).then(response => {
                    return {multi_subreddits: response};
                });
            }

            //note: this is used for the popup onload- this doesn't track the active id while the popup
            //is open
            if (message.request === 'stored_active_id'){
                sendResponse({id: comptroller.manager.storedActiveId})
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
                    if(!comptroller.isURLValidForAddingSubreddits(tab.url)){
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
    //get a sorted copy of all the subreddits
    subredditFolder.subreddits = subredditFolderManager.sortNames(initalSubreddits.filter(elem => true));

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
        var areIncluded = false;
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
        this.subreddits = subredditFolderManager.sortNames(temp);
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
        this.subreddits = subredditFolderManager.sortNames(temp);
        return this.subreddits;
    }

    //makes and returns the full url of the folder's front page
    subredditFolder.getFullURL = function(){
        return 'https://www.reddit.com/r/' + this.subreddits.join('+');
    }

    return subredditFolder;
};

//called once by comptroller to create a singleton manager
var InitSubredditFolderManager = function(){
    var manager = {};
    //this gets filled in at the end from disk
    manager.folders = {};
    //if popup gets null id, will set to first one (if there is one)
    manager.storedActiveId = null

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

    //sorts subreddits, disregarding case
    //use this always when sorting
    //alters subreddits array and also returns it
    manager.sortNames = function(subreddits){
        subreddits.sort(function (a, b) {
            return a.toLowerCase().localeCompare(b.toLowerCase());
        });
        return subreddits;
    }


    //creates and adds a new subreddit folder
    //uses SubredditFolderFactory because it needs the functions too
    //does not save to disk
    //returns the folder object
    manager.addFolder = function(id, initalSubreddits){
        // //check args
        // if (!id){
        //     throw "argument: 'id' required";
        // }
        // if (!manager.isUniqueId(id)){
        //     throw "id must be unique";
        // }
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
        if (!folderId){
            return [];
        }
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