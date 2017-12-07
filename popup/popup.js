//like console.log- just uses the header to relay messages while testing
var testMessage = function(message){
    document.getElementById('title').innerHTML = message;
}



window.addEventListener('unload', eventContext => {
    //remember active folder here
    //browser.runtime.sendMessage({request: 'console', message: 'would save here}'});
});
window.addEventListener('load', eventContext => {
    //rememebr actgive folder here
});



var popupManager = (function(){
    var popupManager = {};
    popupManager.baseURL = 'https://www.reddit.com/r/';
    //store all the elements
    popupManager.folderSelections = document.getElementById('folder-selections');
    popupManager.folderRenameButton = document.getElementById('folder-rename');
    popupManager.folderDuplicateButton = document.getElementById('folder-duplicate');
    popupManager.folderNewButton = document.getElementById('folder-new');
    popupManager.folderRemoveButton = document.getElementById('folder-delete');
    popupManager.gotoFrontPageAnchor =  document.getElementById('goto-frontpage-a');
    popupManager.addSubredditsTextbox = document.getElementById('generic-add-textbox');
    popupManager.addSubredditsButton =  document.getElementById('generic-add-button');
    popupManager.folderDetailsToggle =  document.getElementById('subscription-details-toggle');
    popupManager.folderDetailsDiv =     document.getElementById('subscription-details');
    popupManager.currentPageInclusionToggle = document.getElementById('toggle-for-current');
    popupManager.folderTableDiv =       document.getElementById('subscription-table-div');

    //**********listeners***************** */
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
            testMessage('i am ddd');
            popupManager.addSubredditFromTextbox();
        }
    });
    //user can type in the textbox to add any string. no error checking. probably dangerous
    //automatically splits by '+'
    popupManager.addSubredditFromTextbox = function(){
        if (popupManager.addSubredditsTextbox.value !== ''){
            popupManager.addingSubreddits(popupManager.addSubredditsTextbox.value.toLowerCase().split('+'));
        }
        popupManager.addSubredditsTextbox.value = '';
    };
    //handle displaying / hiding subscription details
    popupManager.folderDetailsToggle.addEventListener('click', eventContext => {
        var details = popupManager.folderDetailsDiv;
        if (!details.style.display || details.style.display === 'none'){
            details.style.display = 'inline';
        } else {
            details.style.display = 'none';
        }
    });

    popupManager.addingFolder = function(id, subreddits){
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
    popupManager.folderRenameButton.addEventListener('click', eventContext => {
        //get new name
        var newId = popupManager.getUniqueIdFromUser();
        var oldId = popupManager.getActiveFolderId();
        //get subreddits of old folder
        browser.runtime.sendMessage({request  : 'folder_subreddits', 
                                     folder_id: oldId})
        .then(response => {
            testMessage(response.folder_subreddits);
            popupManager.addingFolder(newId, response.folder_subreddits).then(() => {
                popupManager.removingFolder(oldId);
            });
        });
    });

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
        if (id === null){
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
            var sending = browser.runtime.sendMessage({request : 'folder_subreddits', folder_id : id});
            return sending.then(response => {   
                if (response.folder_subreddits){
                   this.updatePopup(response.folder_subreddits);
                }
            });
        }
    }

    
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

        //disables stuff if there are no folders
        if (this.getActiveFolderId() === null){
            this.folderDetailsToggle.disabled = true;
            this.folderRenameButton.disabled = true;
            this.folderRemoveButton.disabled = true;
            this.folderDuplicateButton.disabled = true;
            this.folderSelections.disabled = true;
            popupManager.folderDetailsDiv.style.display = 'none';
            return;
        } else {
            this.folderDetailsToggle.disabled = false;
            this.folderDetailsToggle.disabled = false;
            this.folderRenameButton.disabled = false;
            this.folderRemoveButton.disabled = false;
            this.folderDuplicateButton.disabled = false;
            this.folderSelections.disabled = false;
        }
        
        //display message if active folder has no subreddits yet
        if (subreddits.length === 0){
            this.folderTableDiv.innerHTML = "no subscriptions yet";
            return;
        }

        //reset the innerhtml
        this.folderTableDiv.innerHTML = null;
    
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

    

    //called by remove buttons in the table of subreddits
    //rebuilds whole table - could implement a caching system on this end
    popupManager.removingSubreddits = function(subreddits){
        //could be important but i don't see how
        // if (this.getActiveFolderId() === null){
        //     this.updatePopup([]);
        //     return;
        // }
        
        //remove subreddits from backend
        var sending = browser.runtime.sendMessage({ action       : 'remove_subreddits',
                                                    folder_id    : this.getActiveFolderId(),
                                                    subreddits   : subreddits});
        //build anew - really we know what subreddits are left, so this should be done without messaging
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
        //build anew - really we know what subreddits there are now, so this should be done without messaging
        return sending.then(response => {
            if (response.subreddits){
                this.updatePopup(response.subreddits);
            }
        });
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

    return popupManager;
})();


popupManager.initialising();






