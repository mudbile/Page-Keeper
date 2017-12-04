//handles page-specific functions
//  * storing subreddit of page
//  * hiding some elements in the front page (ie the multi)

var anonSays = (function(){
    var retObject = {};
    retObject.currentSubredditName = document.querySelector('.redditname').firstChild.innerHTML;

    //hide list of included subreddits on the multi page
    console.log(retObject.currentSubredditName);
    if (retObject.currentSubredditName === 'multi'){
        document.querySelector('div.sidecontentbox').style.display = 'none';
    }

    //message controller
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.request){
            if (message.request === 'current_subreddit'){
                sendResponse({'current_subreddit': retObject.currentSubredditName});
            }
        }
    });

    return retObject;
})();