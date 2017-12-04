

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
    retObject.removeSubreddit = function(subredditName){
        //create new array of all elements
        var temp = this.subredditNames.filter(elem => true); 
        //remove it if necessary
        var index = temp.indexOf(subredditName);
        if (index >= 0) {
            temp.splice( index, 1 );
        }
        return temp.sort();
    }
    //returns a sorted temp array which is this.subredditNames where subredditName is added
    //if you want to make the change stick, you gotta save it out with saveSubredditsToDisk
    retObject.addSubreddit = function(subredditName){
        //create new array of all elements
        var temp = this.subredditNames.filter(elem => true);
        //add if necessary
        var index = temp.indexOf(subredditName);
        if (index === -1) {
            temp.push(subredditName);
        }
        console.log("new array: " + temp);
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
    var gettingCurrentSubredditOfTab = function(tab){
        return browser.tabs.sendMessage(tab.id, {request: 'current_subreddit'}).then(response => {
            if (response.current_subreddit){
                return response.current_subreddit;
            }
        });
    };

    //message listener controller
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action){
            // action : "add_current" : add current subreddit from active tab
            if (message.action === 'add_current'){
                gettingCurrentTab().then(gettingCurrentSubredditOfTab).then(currentSubreddit => {
                    var temp = retObject.addSubreddit(currentSubreddit);
                    retObject.savingSubredditsToDisk(temp);
                });
            }
            // action : "remove_subreddit" : someone wants to remove a subreddit
            // will contain second property subreddit_name
            // responds with the updated list
            if (message.action === 'remove_subreddit' && message.subreddit_name){
                var temp = retObject.removeSubreddit(message.subreddit_name);
                var saving = retObject.savingSubredditsToDisk(temp);
                saving.then(sendResponse({subscription_list: retObject.subredditNames}));
            }
            // action : "add_subreddit" : someone wants to add a subreddit
            // will contain second property subreddit_name
            // responds with the updated list
            if (message.action === 'add_subreddit' && message.subreddit_name){
                var temp = retObject.addSubreddit(message.subreddit_name);
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
                console.log('sending: ' + {subscription_list: retObject.subredditNames}.subscription_list);
                sendResponse({subscription_list: retObject.subredditNames});
            }
        }
    });

    return retObject;

})();


// fetch('https://www.reddit.com/r/dataisbeautiful/.json?limit=5').then(response => {
//     return response.json();

// }).then(json => {
//     console.log(json.data.children[0].data.title);
// }); 