//stores which folder the user was looking at last
//and the generator settings
window.addEventListener('unload', eventContext => {
    browser.runtime.sendMessage({action: 'store_active_id', id: popupManager.getActiveFolderId()});
    browser.runtime.sendMessage({action: 'store_settings', settings: popupManager.getSettings(true)});
    //remember active folder here
    //browser.runtime.sendMessage({request: 'console', message: 'would save here}'});
});
//loads which folder the user was looking at last
//and the generator settings -or the default settings object
window.addEventListener('load', eventContext => {
    //load and update the folder-specific html parts
    browser.runtime.sendMessage({request: 'stored_active_id'}).then(response => {
        if (response.id){
            popupManager.setActiveFolder(response.id);
        }
    })
    //load in and update the settings html
    browser.runtime.sendMessage({request: 'stored_settings'}).then(response => {
        //setSettings reverts to defaults given argument is falsey. thus, if there
        //was nothing retreived from storage, we will set up with defaults
        if (response){
            popupManager.setSettings(response.settings);
        }
    })
});



var popupManager = (function(){
    var popupManager = {};
    //loaded in if there are no settings stored on disk
    popupManager.defaultSettings = {
        seed: "",
        total_to_get: 10,
        serendipity_weight:1,
        seed_weight: 1,
        num_seed_search_pages_to_get: 10,
        seed_sort_by: "relevance",
        user_subscriber_limit: 0,
        user_active_limit: 0,
        nsfw_restricted: true,
        exclude_list: []
    }

    popupManager.baseURL = 'https://www.reddit.com/r/';
    popupManager.hideConsoleTimer = null;
    //store all the elements
    popupManager.folderSelections = document.getElementById('folder-selections');
    popupManager.folderRenameButton = document.getElementById('folder-rename');
    popupManager.folderDuplicateButton = document.getElementById('folder-duplicate');
    popupManager.folderNewButton = document.getElementById('folder-new');
    popupManager.folderRemoveButton = document.getElementById('folder-delete');
    popupManager.gotoFrontPageAnchor =  document.getElementById('goto-frontpage-a');
    popupManager.addSubredditsTextbox = document.getElementById('generic-add-textbox');
    popupManager.addSubredditsButton =  document.getElementById('generic-add-button');
    popupManager.settingsToggle =  document.getElementById('settings-toggle');
    popupManager.settingsDiv = document.getElementById('settings');
    popupManager.folderDetailsDiv =     document.getElementById('subscription-details');
    popupManager.currentPageInclusionToggle = document.getElementById('toggle-for-current');
    popupManager.folderTableDiv =       document.getElementById('subscription-table-div');
    popupManager.generatorButton = document.getElementById('folder-generate-random');

    popupManager.genNumTotal = document.getElementById('gen-total');
    popupManager.genWeightRandom = document.getElementById('gen-num-random');
    popupManager.genWeightSeeded = document.getElementById('gen-num-seeded');
    popupManager.genNumPages = document.getElementById('gen-num-seeded-pages');
    popupManager.genSubscriberLimit = document.getElementById('gen-subscriber-limit');
    popupManager.genActiveLimit = document.getElementById('gen-active-limit');
    popupManager.genSortBy = document.getElementById('gen-sort-by');
    popupManager.genNSFWAllowed = document.getElementById('gen-nsfw');
    popupManager.genExclude = document.getElementById('gen-exclude');
    popupManager.generatorButton = document.getElementById('folder-generate-random');
    popupManager.console = document.getElementById('console');
    popupManager.seedTextBox = document.getElementById('gen-seed');

    //**********listeners***************** */
    //generates a random folder of subreddits based on generator settings
    popupManager.generatorButton.addEventListener('click', eventContext => {
        //disable button and show the message console in the settings tab
        popupManager.buttonAndConsoleBeforeGeneration();
        //var activeId = popupManager.getActiveFolderId();
        var settings;
        try {
            settings = popupManager.getSettings(false);
        } catch(e){
            popupManager.buttonAndConsoleAfterGeneration(e);
            return;
        }
        if (!settings.seed && settings.seed_weight !== 0){
            popupManager.buttonAndConsoleAfterGeneration("seed required (seed weight > 0)");
            return;
        } 
        popupManager.consoleMessage('retrieving...');
        browser.runtime.sendMessage({action: 'generate_random_folder', settings: settings})
        .then(response => {
            popupManager.buttonAndConsoleAfterGeneration("finished");
            return popupManager.addingFolder(popupManager.getUniqueIdFromBase('generated'), response.subreddits);

        }, reason => {//if the chain of promises fails for some reason it'll propagate all the way up to here:
            popupManager.buttonAndConsoleAfterGeneration("error: " + reason);
            
        })
    });

    //enables generator button and shows a message for a few seconds before hiding the message console
    popupManager.buttonAndConsoleAfterGeneration = function(finalMessage){
        popupManager.generatorButton.disabled = false;
        popupManager.consoleMessage(finalMessage);
        popupManager.hideConsoleTimer = setTimeout(() => {  
            popupManager.console.style.display = 'none';
            popupManager.console.value = "";
        }, 4000)
    }
    //disables the button and shows the message console
    popupManager.buttonAndConsoleBeforeGeneration = function(){
        clearTimeout(popupManager.hideConsoleTimer);
        popupManager.generatorButton.disabled = true;
        popupManager.console.value = "";
        popupManager.console.style.display = 'inline';
    }
    //wrapper function for writing something out to the message console
    popupManager.consoleMessage = function(message){
        popupManager.console.value = message;
    }

    //returns the unique id <base>_<i> where base is given and i is minimum tpo make it unique
    //assumes less than 1000 with same base
    popupManager.getUniqueIdFromBase = function(base){
        var i = 0;
        var pool = popupManager.getIdPool();
        var potentialId = base+'_'+("000" + i).slice(-3);
        while(popupManager.isValueInArray(potentialId, pool)){
            ++i;
            potentialId = base+'_'+("000" + i).slice(-3);
        }
        return potentialId;
    }

    //refreshes the subreddit table when a new folder selection is made
    popupManager.folderSelections.addEventListener('change', eventContext => {
        popupManager.setActiveFolder(popupManager.getActiveFolderId());
    });
    //close the browser action popup when they navigate to a folder's front page
    popupManager.gotoFrontPageAnchor.addEventListener('click', eventContext => {
        //need to make it async, otherwise the anchor doesn't get to function before window closes
        setTimeout(() => {window.close();}, 10);
    });
    //user can add an arbitrary subreddit to a folder by pressing <enter> or the "add" button
    popupManager.addSubredditsButton.addEventListener('click', eventContext =>{
        popupManager.addSubredditFromTextbox();
    });
    popupManager.addSubredditsTextbox.addEventListener('keyup', eventContext => {
        if (eventContext.key === 'Enter' ) {
            popupManager.addSubredditFromTextbox();
        }
    });
    
    //handle displaying / hiding subscription details
    popupManager.settingsToggle.addEventListener('click', eventContext => {
        var details = popupManager.settingsDiv;
        if (!details.style.display || details.style.display === 'none'){
            details.style.display = 'inline';
        } else {
            details.style.display = 'none';
        }
    });

    //adds a new folder and updates the ui
    //won't take much for me to want to pull the guts out into a function
    popupManager.folderNewButton.addEventListener('click', eventContext => {
        var id = popupManager.getUniqueIdFromUser();
        popupManager.addingFolder(id);
    });
    //deletes the selected folder and updates the ui
    //won't take much for me to want to pull the guts out into a function
    popupManager.folderRemoveButton.addEventListener('click', eventContext => {
        var id = popupManager.folderSelections.selectedOptions[0].text;
        popupManager.removingFolder(id);
    });
    //makes a copy of active folder, asking user for id for new folder
    popupManager.folderDuplicateButton.addEventListener('click', eventContext => {
        var copyFromId = popupManager.folderSelections.selectedOptions[0].text;
        var copyToId = popupManager.getUniqueIdFromUser();
        popupManager.duplicatingFolder(copyFromId, copyToId);
    });
    //duplicates and then removes old copy- this is beacuse i want the folders immutable
    popupManager.folderRenameButton.addEventListener('click', eventContext => {
        var newId = popupManager.getUniqueIdFromUser();
        var oldId = popupManager.getActiveFolderId();
        //you have to remove folder after duplicating, not async, because
        //you dont know when the active folder will change AND when the subreddits
        //have been copied
        popupManager.duplicatingFolder(oldId, newId).then(() => {
            popupManager.removingFolder(oldId);
        });
    });

    //makes a copy of a folder, giving it the id: copyToId, and updates ui
    popupManager.duplicatingFolder = function(copyFromId, copyToId){
        var sending = popupManager.gettingFolderSubreddits(copyFromId);
        return sending.then(folderSubreddits => {
            return popupManager.addingFolder(copyToId, folderSubreddits);
        })
    }

    //user can type in the textbox to add any string. no error checking. probably dangerous
    //automatically splits by '+'
    popupManager.addSubredditFromTextbox = function(){
        if (popupManager.addSubredditsTextbox.value !== ''){
            popupManager.addingSubreddits(popupManager.addSubredditsTextbox.value.toLowerCase().split('+'));
        }
        popupManager.addSubredditsTextbox.value = '';
    };

    //subreddits optional - defaults to []
    popupManager.addingFolder = function(id, subreddits){
        if (!id){
            return;
        }
        if (!subreddits){
            subreddits = [];
        }
        //add folder to disk
        var sending = browser.runtime.sendMessage({action: 'add_folder', folder_id: id, subreddits: subreddits});
        //update the ui
        return sending.then(response => {
            popupManager.addFolderToSelections(id);
            popupManager.setActiveFolder(id, response.subreddits);
        });
    };
    popupManager.removingFolder = function(id){
        //remove folder from disk
        var sending = browser.runtime.sendMessage({action: 'remove_folder', folder_id: id});
        //update the ui
        return sending.then(() => {
            popupManager.removeFolderFromSelections(id);
            popupManager.setActiveFolder(popupManager.getActiveFolderId());
        });
    };

    //prompts are optional- there are defaults
    //returns null on cancel
    popupManager.getUniqueIdFromUser = function(prompt1, prompt2){
        //configure prompts
        if (!prompt1){
            prompt1 = 'Enter a unique name: ';
        }
        if (!prompt2){
            prompt2 = 'Name already exists. Enter a unique name: ';
        }
        //get name from user
        var id = prompt(prompt1);
        if (id === null || id.trim() === ""){
            return null;
        }
        while(popupManager.isValueInArray(id, popupManager.getIdPool())){
            id = prompt(prompt2);
            if (id === null){
                return;
            }
        }
        return id;
    }


    //helper function
    popupManager.isValueInArray = function(value, array){
        return array.indexOf(value) !== -1;
    }

    //returns an array of all the folder names
    popupManager.getIdPool = function(){
        var options = this.folderSelections.options;
        var pool = [];
        for (var i = 0; i != options.length; ++i){
            pool.push(options[i].text);
        }
        return pool;
    }


    //converts text to integer. throws error unless integer and non-negative unless
    //failGraceful is true- if failGraceful is true then it returns 0;
    popupManager.textToNonNegInt = function(text, fieldName, failGraceful){
        var val = Number(text);
        if(!isNaN(text) && parseInt(val) == text && !isNaN(parseInt(text, 10)) && val >= 0){
            return val;
        } else {
            if (failGraceful){
                return 0;
            } else {
                throw "invalid argument: " + fieldName;
            }
        }
    };
    //takes comma-separated (or spaces) words and returns an array of those values
    popupManager.commaListToArray = function(text){
        console.log(text);
        //split by comma or space
        return text.split(/[ ,]+/);
    };
    //takes an array and returns a comma-separated string.
    popupManager.arrayToCommaList = function(array){
        return array.join(', ');
    };



    //grabs the values from the settings html and returns as an object
    //allow invalid for when you're storing to disk- will just save invalid text inputs as 0
    popupManager.getSettings = function(allowInvalid){
        var settingsObj = {
            seed: popupManager.seedTextBox.value,
            total_to_get: popupManager.textToNonNegInt(popupManager.genNumTotal.value, "total", allowInvalid),
            serendipity_weight: popupManager.textToNonNegInt(popupManager.genWeightRandom.value, "random weight", allowInvalid),
            seed_weight: popupManager.textToNonNegInt(popupManager.genWeightSeeded.value, "seed weight", allowInvalid),
            num_seed_search_pages_to_get: popupManager.textToNonNegInt(popupManager.genNumPages.value, "number search pages", allowInvalid),
            seed_sort_by: popupManager.genSortBy.selectedOptions[0].value,
            user_subscriber_limit: popupManager.textToNonNegInt(popupManager.genSubscriberLimit.value, "subscriber limit", allowInvalid),
            user_active_limit: popupManager.textToNonNegInt(popupManager.genActiveLimit.value, "active user limit", allowInvalid),
            nsfw_restricted: !popupManager.genNSFWAllowed.checked,
            exclude_list: popupManager.commaListToArray(popupManager.genExclude.value)
        };
        return settingsObj;
    }

    //updates html to reflect a settings object
    //falls back to default values if there's no settingsObject given
    popupManager.setSettings = function(settingsObj){

        if (!settingsObj){
            settingsObj = popupManager.defaultSettings;
        }
        popupManager.seedTextBox.value = settingsObj.seed;
        popupManager.genNumTotal.value = settingsObj.total_to_get;
        popupManager.genWeightRandom.value = settingsObj.serendipity_weight;
        popupManager.genWeightSeeded.value = settingsObj.seed_weight;
        popupManager.genNumPages.value = settingsObj.num_seed_search_pages_to_get;
        //set selected option
        for (var i = 0; i != popupManager.genSortBy.options.length; ++i){
            var opt = popupManager.genSortBy.options[i];
            if (opt.value === settingsObj.seed_sort_by){
                opt.selected = true;
            } else {
                opt.selected = false;
            }
        }
        popupManager.genSubscriberLimit.value = settingsObj.user_subscriber_limit;
        popupManager.genActiveLimit.value = settingsObj.user_active_limit;
        popupManager.genNSFWAllowed.checked = !settingsObj.nsfw_restricted;
        popupManager.genExclude.value = popupManager.arrayToCommaList(settingsObj.exclude_list);
    }

    

    //adds a folder the selections menu item
    popupManager.addFolderToSelections = function(id){
        this.folderSelections.add(new Option(id));
        this.sortOptions();
    }
    //removes a folder the selections menu item
    popupManager.removeFolderFromSelections = function(id){
                var options = popupManager.folderSelections.options;
                var optionToDelete = null;
                //find the options element that matched the id
                for (var i = 0; i != options.length; ++i){
                    if (options[i].value === id){
                        optionToDelete = options[i];
                        break;
                    }
                }
                //remove it if it's not still null
                optionToDelete && this.folderSelections.remove(optionToDelete.index);
            }
    
    //sorts the selection menu items into alphabetical order
    popupManager.sortOptions= function(){
        var sortedOptions = this.getIdPool().sort();
        for (var i = 0; i != sortedOptions.length; ++i ){
            this.folderSelections[i].text = sortedOptions[i];
        }
    }

    //refreshes ui to a given folder
    //subreddit can be supplied- otherwise will ask background.js to supply
    popupManager.setActiveFolder = function(id, subreddits){
         //if no id is given, sets to first option if one exists
        if (!id){
            if (popupManager.folderSelections.options.length !== 0){
                popupManager.folderSelections.options[0].selected = true;
                id = popupManager.folderSelections.options[0].text;
            } else {
                this.updatePopup([]);
                return;
            }
        //otherwise sets to given id
        } else {
            //set html selection to option with given id
            var options = popupManager.folderSelections.options;
            for (var i = 0; i != options.length; ++i){
                if (options[i].value === id){
                    options[i].selected = true;
                }
            }
        }
        //shortcuts if subreddits are supplied
        if (subreddits){
            this.updatePopup(subreddits);
        } else {
            var sending = popupManager.gettingFolderSubreddits(id);
            return sending.then(folderSubreddits => {   
                this.updatePopup(folderSubreddits);
            });
        }
    };

    //all requests to get folder subreddits go through this
    //sends message to get folder subreddits from disk
    popupManager.gettingFolderSubreddits = function(id){
        var sending = browser.runtime.sendMessage({request : 'folder_subreddits', folder_id : id});
        return sending.then(response => {
            if (response.folder_subreddits){
                return response.folder_subreddits;
             } else {
                 return Promise.reject('folder_subreddits property of response is falsey');
             }
        });
    };

    
    //returns null if no folders
    popupManager.getActiveFolderId = function(){
        //selecctedOptions is an array of the options with selected === true.
        //we deal in single selections, so don't worry about that too much
        var selectedOptions = popupManager.folderSelections.selectedOptions;
        if (selectedOptions.length === 0){
            return null;
        } else {
            return selectedOptions[0].value;
        }
    }

    //joins all the subreddit names into a url for the "go to frontpage" button
    popupManager.updateFrontpageHref = function(subreddits){
        var url;
        //go to reddit home if there are no subreddits stored
        if (subreddits.length === 0){
            url = 'https://www.reddit.com/';
        } else {
            url = 'https://www.reddit.com/r/' + subreddits.join('+');
        }
        popupManager.gotoFrontPageAnchor.setAttribute('href', url);
    };


    //updates the popup ui
    //does not update folder selections- setActiveFolder does that
    //dynamically creats a table of subreddit names for active folder and inserts into popup dom
    //also updates frontpage url for the anchor and the toggle button's state
    //disables stuff if there are no folders
    popupManager.updatePopup = function(subreddits){
        this.updateToggleState(); 
        this.updateFrontpageHref(subreddits);
        //start from scratch
        this.folderTableDiv.innerHTML = null;

        //disables stuff if there are no folders
        if (this.getActiveFolderId() === null){
            this.folderRenameButton.disabled = true;
            this.folderRemoveButton.disabled = true;
            this.folderDuplicateButton.disabled = true;
            this.folderSelections.disabled = true;
            this.addSubredditsButton.disabled = true;
            this.addSubredditsTextbox.disabled = true;
            return;
        } else {
            this.addSubredditsButton.disabled = false;
            this.addSubredditsTextbox.disabled = false;
            this.folderRenameButton.disabled = false;
            this.folderRemoveButton.disabled = false;
            this.folderDuplicateButton.disabled = false;
            this.folderSelections.disabled = false;
        }
    
        
        //init table
        var folderTable = document.createElement('table');
        folderTable.id = 'subscription-table';
        this.folderTableDiv.appendChild(folderTable);
        //process each subredditName -> each row
        subreddits.forEach((subredditName, index) => {
            var row = document.createElement('tr');
            //modulo 2 css design
            if (index % 2){
                row.classList.add('row-odd');
            } else {
                row.classList.add('row-even');
            }
            //subreddit name
            var col1 = document.createElement('td');
            col1.classList.add('col-1');
            col1.appendChild(document.createElement('a'));
            col1.firstElementChild.classList.add('subscription-list-a');
            col1.firstElementChild.setAttribute("href", popupManager.baseURL + subredditName + '/'); 
            col1.firstElementChild.innerHTML = subredditName;
            //remove button
            var col2 = document.createElement('td');
            col2.classList.add('col-2');
            col2.appendChild(document.createElement('button'));
            col2.firstElementChild.classList.add('subscription-list-remove');
            col2.firstElementChild.setAttribute("type", "button");
            col2.firstElementChild.innerHTML = "remove";
            col2.addEventListener('click', eventContext => {popupManager.removingSubreddits([subredditName])});
            //attach
            row.appendChild(col1);
            row.appendChild(col2);
            folderTable.appendChild(row);
        });
    }

    popupManager.gettingCurrentURL = function(){
        return browser.runtime.sendMessage({request: 'current_url'}).then(response => {
            return response.current_url;
        });
    }

    popupManager.enableGeneratorButtonIfAllowed = function(){
        popupManager.gettingCurrentURL().then(url => {
            if (url && url.startsWith('https://www.reddit.com')){
                popupManager.generatorButton.disabled = false;
            } else {
                popupManager.generatorButton.disabled = true;
            }   
        });
    }

    //called by remove buttons in the table of subreddits
    //rebuilds whole table - could implement a caching system on this end
    popupManager.removingSubreddits = function(subreddits){
        //remove subreddits from backend
        var sending = browser.runtime.sendMessage({ action       : 'remove_subreddits',
                                                    folder_id    : this.getActiveFolderId(),
                                                    subreddits   : subreddits});
        //build anew - really we know what subreddits are left
        //var originalSubreddits = 
        //var subredditsLeft = subreddits.filter(elem => popupManager.isValueInArray(elem, originalSubreddits));
        return sending.then(response => {
            if (response.subreddits){
                this.updatePopup(response.subreddits);
            }
        });
    }

    //called by add button next to textbox for adding a subreddit by name
    //rebuilds whole table - could implement a caching system on this end
    popupManager.addingSubreddits = function(subreddits){
        // if (this.getActiveFolderId() === null){
        //     this.updatePopup([]);
        //     return;
        // }
        var sending = browser.runtime.sendMessage({ action       : 'add_subreddits',
                                                    folder_id    : this.getActiveFolderId(),
                                                    subreddits   : subreddits});
        //build anew - really we know what subreddits there are now, so we don't wait for sending
        return sending.then(response => {
            this.updatePopup(response.subreddits);
        })
        
    }


    //updates the "current subreddit" toggle
    popupManager.updateToggleState = function(){
        if (this.getActiveFolderId() === null){
            this.currentPageInclusionToggle.disabled = true;
            return;
        }
        
        //on failure, this disables the toggle
        browser.runtime.sendMessage({   request     : 'toggle_permission', 
                                        folder_id   : this.getActiveFolderId()})
        .then(response => {
            this.currentPageInclusionToggle.disabled = false;
            if (response){
                //we don't want to be able to remove any if it's a 
                //multi (subreddit_included returns false)
                //we can, however, add from a multi- which adds them all
                if (response.subreddit_included){
                    this.currentPageInclusionToggle.innerHTML = '–';
                    this.currentPageInclusionToggle.onclick = eventContext => {this.removingSubreddits([response.subreddits[0]])};
                } else {
                    this.currentPageInclusionToggle.innerHTML = '+';
                    this.currentPageInclusionToggle.onclick = eventContext => {this.addingSubreddits(response.subreddits)};
                }
            } 
        }, reason => {
            this.currentPageInclusionToggle.disabled = true;
        });
    }

    //populates the selection dropdown ui with folders
    popupManager.buildSelectionList = function(folderIdArray){
        for(var i = 0; i != folderIdArray.length; ++i){
            this.folderSelections.add(new Option(folderIdArray[i]));
        }
        this.sortOptions();
    }

    //starts the show- grabs the folder ids, builds the selection list and refreshes the ui to
    //the active (ie first) one - or, if there are none, setActiveFolder will disable things appropriately
    popupManager.initialising = function(){
        //get all folder ids
        return browser.runtime.sendMessage({request: 'folders'})
                       .then(response => { 
                           popupManager.buildSelectionList(response.folders);
                           popupManager.setActiveFolder(popupManager.getActiveFolderId());
                        })
    }
    popupManager.enableGeneratorButtonIfAllowed();
    return popupManager;
})();


popupManager.initialising();