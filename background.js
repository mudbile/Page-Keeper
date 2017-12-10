//TODO:
//          - store out 'after' for seed searches for a particular phrase (have setting whether to do so
//                    and whether to use it)
//          -add weighting and stuff for comments search- exactly the same as subreddit seed search but use
//              response.data.children[i].data.subreddit instead of response.data.children[i].data.display_name
//          -go through and provide failure functions for promises (particularly high-level gui stuff)
//          -idea - get authors of content and go through them to other subreddits

var randomGenerator = (function() {
    //https://www.reddit.com/search.json?q=<seed>&sort=relevance&type=sr/')); but get after random count
    
    var generator = {
        //weights are used to calculate how many of each to get - if total is 10 and one is 30 and the other 70, 
        //then one will get 3 and the other 10
        seed: null,
        weights : {
            serendipity : null,
            seed : null
        },
        numToGet : {
            total : null,
            serendipity : null,
            seed : null
        },
        user_subscriber_limit: null,
        user_active_limit: null,
        nsfw_restricted: null,
        //seed word/phrase
        seed : null,
        //list of subreddit names to exclude from results
        excludeList : null,
        //number of pages to grab for the seed search- dictates the size of the pool
        num_seed_search_pages_to_get: null,
        //can be 'relevance', 'new', 'top', etc.
        seed_sort_by: null
    };


    /*******************SPECIFIC TO GUIDED SEARCH*************************/


    //returns an array of as many subreddit names as it can, given the seed results and the
    //value of generator.numSeedSearchPagesToGet
    //there should be no duplicates, so we dont call cleanArray, just checkAgainstRestrictions
    generator.gettingSeedNamesFromReddit = function(seed){
        var url = 'https://www.reddit.com/search.json?q='+seed+'&sort='+generator.seedSortBy+'&type=sr';
        //set initial values for the object, which will pass through the chain sequentially
        var waitChain = Promise.resolve({possibilities: [], after: ''});
        //attach links to the chain
        //loop may add many more links than that many which return after === null, but because
        //setting the after attribute happens async, there's no good way around it- it will just quickly
        //pass on the results anyway
        for (var i = 0; i !== generator.numSeedSearchPagesToGet; ++i){
            waitChain = waitChain.then(previousLinkResult => {
                //a link will make the previousLinkResult.after property null
                //if there are no more pages to get OR something's wrong wih the json
                if (previousLinkResult.after === null){
                    return previousLinkResult;
                }
                var fullURL = url +'&after='+previousLinkResult.after;
                //get the json, from that the subreddits that pass restrictions test...
                return generator.gettingRedditApiResponse(fullURL).then(response => {
                    //check data
                    var dataOkay = response && response.data && response.data.after
                                && response.data.children;
                    if (dataOkay){
                        var subredditPromises = [];
                        //fill in the promised data
                        response.data.children.forEach(child => {
                            //will add a null if it fails
                            subredditPromises.push(generator.checkingSubredditAgainstRestrictions(child.data.display_name));
                            //check restrictions- if this fails we still want to keep going with others
                        });
                        //wait for all the subreddits to be checked and filter them.
                        //elem === null means they failed.
                        return Promise.all(subredditPromises).then(results => {
                            var filtered = results.filter(elem => elem !== null);
                            previousLinkResult.possibilities = previousLinkResult.possibilities.concat(filtered);
                            //response.data.after is either null or gives the code for the 'after' url setting
                            previousLinkResult.after = response.data.after;
                            return previousLinkResult;
                        });
                    } else {
                        //console.log(data);
                        //previousLinkResult.after = null;
                        return previousLinkResult;
                    }                    
                });
            });//.then(previousLinkResult => generator.pausing(2000, previousLinkResult))
        }
        //extract the names- they're what you actually want
        return waitChain.then(lastLinkResult => {return lastLinkResult.possibilities;});
    }



    //returns an array of promises for the seeded group of subreddits
    generator.gettingSeededSubreddits = function(numToGet, seed){
        if (numToGet === 0){
            return [];
        }
        //get and store first num_seed_search_pages_to_get pages of search results
        return generator.gettingSeedNamesFromReddit(seed).then(possibilities => {
            return generator.chooseRandomElements(numToGet, possibilities);
        })

    }


    /*******************SPECIFIC TO RANDOM SEARCH*************************/


    //returns a promised list of random subreddits similar to using the serendipity button on reddit
    //moreExcludedSubreddits iis used to pass the growing list of subreddits down the recusion line,
    //so the child can reject subreddits already got
    //on each recursive call, moreExcludedSubreddits contains the okaySubreddits up to that point 
    generator.gettingSerendipitySubreddits = function(numToGet, moreExcludedSubreddits){
        if (!moreExcludedSubreddits){
            moreExcludedSubreddits = [];
        }
        if (numToGet === 0){
            return [];
        }
        //array is filled iwth promises that return a subreddit name
        //gets same amount every time, then pares it down to numToget afterwards
        var subredditPromises = new Array(generator.numToGet.serendipity);
        for (var i = 0; i != generator.numToGet.serendipity; ++i){             
            //returns null for failed names/json retreivals
            //the gettingRedditApiResponse call actually returns a random comment from a random sub
            //because for some reason 'https://www.reddit.com/r/random/.json?&limit=1/' gives x-origin error
            subredditPromises[i] = generator.gettingRedditApiResponse('https://www.reddit.com/random/.json?&limit=1/')
                                            .then(response => {
                                                //check data
                                                var dataOkay = response && response[0] && response[0].data 
                                                    && response[0].data.children && response[0].data.children[0]
                                                    && response[0].data.children[0].data.subreddit
                                                    //fail for those weird pseudo-dubreddits that are actually user accounts
                                                    && !response[0].data.children[0].data
                                                                  .subreddit_name_prefixed.startsWith('u/');
                                                if (dataOkay){
                                                    var id = response[0].data.children[0].data.subreddit;
                                                    //fill in the promised data - a subreddit name
                                                    return generator.checkingSubredditAgainstRestrictions(id);
       
                                                } else {
                                                    return null;
                                                }
                                            });
        }
        //now we need to ensure there are no duplicates and no excluded subreddits
        //but we still need to fill the quota, so there's recursion
        return Promise.all(subredditPromises).then(subreddits => {
            var okaySubredits = generator.cleanSubredditArray(subreddits, moreExcludedSubreddits);
            //the quota being filled is our base condition
            if (okaySubredits.length >= numToGet){
                var paredDown = generator.chooseRandomElements(numToGet, okaySubredits);
                return paredDown;
            //otherwise concat the results of a recursive call asking 
            //for the number of subreddits still to get, and return that 
            } else {                
                var stillToGet = numToGet - okaySubredits.length;
                return generator.gettingSerendipitySubreddits(stillToGet, okaySubredits.concat(moreExcludedSubreddits))
                                .then(moreSubreddits => {
                                    //console.log(generator.cleanSubredditArray(okaySubredits.concat(moreSubreddits)));
                                    //return generator.cleanSubredditArray(okaySubredits.concat(moreSubreddits));
                                    return okaySubredits.concat(moreSubreddits);
                });
            }
        });
    }

    //returns new array with no duplicates and none that are in excludeList
    //OR in the optional moreExcludedSubreddits. removes null entries too
    generator.cleanSubredditArray = function(subreddits, moreExcludedSubreddits){
        if (!moreExcludedSubreddits){
            moreExcludedSubreddits = [];
        }
        var okaySubreddits = [];
        for (var i = 0; i != subreddits.length; ++i){
            var checkingThisSubreddit = subreddits[i];
            if (checkingThisSubreddit 
                && moreExcludedSubreddits.indexOf(checkingThisSubreddit) === -1
                && generator.excludeList.indexOf(checkingThisSubreddit) === -1 
                &&     okaySubreddits.indexOf(checkingThisSubreddit) === -1){
                okaySubreddits.push(checkingThisSubreddit);
            }
        }
        return okaySubreddits;
    }

    /*******************USEFUL TO BOTH*************************/

     //This function returns a random number between [min, max)
    //max and min must be given as integers
    generator.randBetween = function(min, max){
        return Math.floor(Math.random() * (max - min)) + min;
    };

    //fisher-yates
    generator.shuffleArrayInPlace = function(array){
        for(var i = 0; i != array.length - 2; ++i){
            var j = generator.randBetween(i, array.length);
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
    }

    //randomly selects numToGet elements from an array of string possibilities
    //returns new array but does shuffle given array
    generator.chooseRandomElements = function(numToGet, possibilities){
        if (numToGet >= possibilities.length){
            return possibilities;
        }

        //shuffle the Array
        generator.shuffleArrayInPlace(possibilities);
        //reduce numToGet if need be
        
        //slice a chunk from the shuffled array [begin, end)
        var subreddits = possibilities.slice(0, numToGet);
        return subreddits;
    }

    

    //returns id on pass, null on fail (null so it's removed on subreddit array clean step)
    // checks exclusion list and restrictions
    //but it's kept here for completeness for other methods
    generator.checkingSubredditAgainstRestrictions = function(id){
        var gettingInfo = generator.gettingRedditApiResponse('https://www.reddit.com/r/'+id+'/about/.json');
        return gettingInfo.then(info => {
            if (info && info.data && generator.excludeList.indexOf(id) === -1
                && (info.data.over18 === false || generator.nsfw_restricted === true)
                && (info.data.subscribers < generator.userSubscriberLimit || generator.userSubscriberLimit <= 0)
                && (info.data.accounts_active < generator.userActiveLimit || generator.userActiveLimit <= 0)
            ){
                return id;
            } else {
                return null;
            }
        });
    };



    /*******************MAIN FUNCTIONS*************************/

    //call this from outside object
    //whill call for serendipitous subreddits and seed subreddits async, then adds them together
    generator.generatingRandomFolder = function(settings){
        console.log(settings);
        generator.initialisingValues(settings);
        var promises = new Array(2);
        //get both sets async
        promises[0] = generator.gettingSerendipitySubreddits(generator.numToGet.serendipity);
        promises[1] = generator.gettingSeededSubreddits(generator.numToGet.seed, generator.seed);
        //return them all as one array
        return Promise.all(promises).then(groups => {
            //add the ones from seeds that aren't already in serendip group
            var subreddits = groups[0];
            for (var i = 0; i != groups[1].length; ++i){
                if (subreddits.indexOf(groups[1][i]) === -1){
                    subreddits.push(groups[1][i]);
                }
            }
            return subreddits;
        });
    }


    //fille dgenerator object with values from settings
    generator.initialisingValues = function(settings){
        generator.seed = settings.seed;
        generator.numToGet.total = settings.total_to_get;
        generator.weights.serendipity = settings.serendipity_weight;
        generator.weights.seed = settings.seed_weight;
        if (generator.weights.serendipity + generator.weights.seed === 0){
            generator.numToGet.seed = 0;
            generator.numToGet.serendipity = 0;
        } else {
            generator.numToGet.seed = Math.floor(generator.numToGet.total * (generator.weights.seed / 
                (generator.weights.serendipity + generator.weights.seed)));
            generator.numToGet.serendipity = generator.numToGet.total - generator.numToGet.seed;
        }        
        generator.numSeedSearchPagesToGet =  settings.num_seed_search_pages_to_get;
        generator.seedSortBy = settings.seed_sort_by;
        generator.userSubscriberLimit =  settings.user_subscriber_limit;
        generator.userActiveLimit =  settings.user_active_limit;
        generator.nsfwRestricted = settings.nsfw_restricted;
        generator.excludeList = settings.exclude_list;
        //exclude_list: ['news', 'interestingasfuck', 'todayilearned', 'gaming', 'MurderedByWords', 'MemeEconomy', 'OldSchoolCool', 'mildlyinteresting', 'whitepeoplegifs', 'aww', 'The_Donald', 'technology', ]
    } 

    
 

    //given an api url(e.g. https://www.reddit.com/api/multi/user/deltaprogress/m/artncomics/.json)
    //returns the decoded json object found there
    generator.gettingRedditApiResponse = function(apiURL){
        return fetch(apiURL).then(response => {
            return response.json();
        }, reason => {return null;}); 
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

    //stores settings object to disk
    comptroller.storingSettings = function(settings){
        browser.storage.local.set({'settings': settings});
        console.log('here');
        console.log(settings);

    }

    //loads settings object from disk
    comptroller.gettingSettings = function(settings){
        return browser.storage.local.get('settings');
    }




    //message listener controller
    //you can either return info by sendresponse or by returning a promise that returns some info
    //NOTE: error checking is done client side before seding a message through.
    //both actions and requests return stuff. it's turned out not to be as helpful a distinction as i thought
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log(sender);
        if (message.action){
            if (message.action === 'generate_random_folder' && message.settings){
                var getting = randomGenerator.generatingRandomFolder(message.settings);
                return getting.then(subreddits => {
                    return {subreddits: subreddits};
                });
            }
            //storesd given settings object to disk
            if (message.action === 'store_settings' && message.settings){
                comptroller.storingSettings(message.settings);
            }

            //note: this is used for the popup unload- this doesn't track the active id while the popup
            //is open
            if (message.action === 'store_active_id' && message.id){
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
            //gets settings object from disk
            if (message.request === 'stored_settings'){
                return comptroller.gettingSettings();
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