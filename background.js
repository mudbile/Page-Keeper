

var comptroller = (function(){
    var retObject = {};
    retObject.subredditNames = ['science', 'australia'].sort();
    retObject.baseString = 'https://www.reddit.com/r/';

    //takes a subreddit name, returns whether it's currently included in array
    retObject.isSubredditIncluded = function(subredditName){
            return (this.subredditNames.indexOf(subredditName) != -1);
    };


    //returns a sorted temp array which is this.subredditNames where subredditName is not present
    //assumes max of one instance of subredditName
    //if you want to make the change stick, you gotta save it out with saveSubredditsToDisk
    retObject.removeSubreddits = function(subredditNames){
        //create new array without elements
        var temp = this.subredditNames.filter(elem => subredditNames.indexOf(elem) == -1);
        return temp.sort();
    }
    //returns a sorted temp array which is this.subredditNames where subredditName is added
    //if you want to make the change stick, you gotta save it out with saveSubredditsToDisk
    retObject.addSubreddits = function(subredditNames){
        //create new array of all elements
        var temp = this.subredditNames.filter(elem => true);
        //add if necessary
        for(var i = 0; i != subredditNames.length; ++i){
            var index = temp.indexOf(subredditNames[i]);
            if (index === -1) {
                temp.push(subredditNames[i]);
            }
        }
        return temp.sort();
    }

    //makes and returns the full url of the front page
    retObject.getFullURL = function(){
        return this.baseString + this.subredditNames.join('+');
    }
    
    //loads in subredditNames from local disk and returns full url of the front page
    //change from get to sync if you want to make it synced across devices
    retObject.updatingSubredditsFromDisk = function() {
        return browser.storage.local.get('subredditNames').then((info) => {
            if (info.subredditNames){
                this.subredditNames = info.subredditNames;
            }
            return this.getFullURL();
        });
    };

    //saves out an array pf subredditNames to local disk and updates this.subredditNames
    retObject.savingSubredditsToDisk = function(subredditNames){
        this.subredditNames = subredditNames;
        return browser.storage.local.set({'subredditNames': this.subredditNames});
    }



    //initial load in from disk
    retObject.updatingSubredditsFromDisk().then((urlString) => {
        console.log(urlString);
    });






    //queries for the currently active tab
    var gettingCurrentTab = function(){
        return browser.tabs.query({
            currentWindow: true,
            active: true
        }).then(tabs => { return tabs[0];});
    };





    //converses with given tab to retrieve current subreddit
    var gettingCurrentSubredditsOfTab = function(tab){
        return browser.tabs.sendMessage(tab.id, {request: 'current_subreddits'}).then(response => {
            if (response.current_subreddits){
                return response.current_subreddits;
            }
        });
    };

    //message listener controller
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action){
            // // action : "add_current" : add current subreddit from active tab
            // if (message.action === 'add_current'){
            //     gettingCurrentTab().then(gettingCurrentSubredditOfTab).then(currentSubreddit => {
            //         var temp = retObject.addSubreddit(currentSubreddit);
            //         retObject.savingSubredditsToDisk(temp);
            //     });
            // }
            // action : "remove_subreddit" : someone wants to remove a subreddit
            // will contain second property subreddit_name
            // responds with the updated list
            if (message.action === 'remove_subreddits' && message.subreddit_names){4
                var temp = retObject.removeSubreddits(message.subreddit_names);
                var saving = retObject.savingSubredditsToDisk(temp);
                saving.then(sendResponse({subscription_list: retObject.subredditNames}));
            }
            // action : "add_subreddit" : someone wants to add a subreddit
            // will contain second property subreddit_name
            // responds with the updated list
            if (message.action === 'add_subreddits' && message.subreddit_names){
                var temp = retObject.addSubreddits(message.subreddit_names);
                var saving = retObject.savingSubredditsToDisk(temp);
                saving.then(sendResponse({subscription_list: retObject.subredditNames}));
            }
            // action : "goto_frontpage" : change currently active tab to front page
            if (message.action === 'goto_frontpage'){
                gettingCurrentTab().then(tab => {
                    browser.tabs.update({url: retObject.getFullURL()})
                }); 
            }
        } else if (message.request){
            // request : "subscription_list" : they want the current list
            if (message.request === 'subscription_list'){
                sendResponse({subscription_list: retObject.subredditNames});
            }
            // request : "toggle_status" : popup wants info for toggle button
            //does not handle 'multi' yet- just returns 'multi' as the subreddit
            if (message.request === 'toggle_permission'){
                return gettingCurrentTab().then(tab => {
                    console.log('url:' + tab.url);
                    if (!tab.url.startsWith(retObject.baseString)){
                        return new Promise.reject("active tab is not of reddit domain");
                    } else {
                        return tab;
                    }
                }).then(gettingCurrentSubredditsOfTab)
                  .then(currentSubreddits => {
                    return {
                            subreddit_included:  currentSubreddits.length == 1 
                                                 && retObject.isSubredditIncluded(currentSubreddits[0]),
                            subreddits: currentSubreddits
                    };
                });
            }
        }
    });

    return retObject;

})();




// browser.tabs.onActivated.addListener(activeInfo => {
//     browser.tabs.get(activeInfo.tabId).then(tab => {
//         var retObject;
//         if (tab.url.startsWith('https://www.reddit.com/')){
//             gettingCurrentSubredditOfTab().then(subredditName => {
//                 retObject = {
//                                  action: 'update_toggle', 
//                                  valid: true,
//                                  included: comptroller.isSubredditIncluded(subredditName),
//                                  subreddit_name: subredditName
//                 }
//                 browser.runtime.sendMessage(retObject);
//             });
//         } else {
//             retObject = {
//                 action: 'update_toggle', 
//                 valid: false,
//                 included: null,
//                 subreddit_name: null
//             }
//             browser.runtime.sendMessage(retObject);
//         }
//     });
// });






// fetch('https://www.reddit.com/r/dataisbeautiful/.json?limit=5').then(response => {
//     return response.json();

// }).then(json => {
//     console.log(json.data.children[0].data.title);
// }); 