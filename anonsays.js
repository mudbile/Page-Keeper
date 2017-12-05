//handles page-specific functions
//  * storing subreddit of page
//  * hiding some elements in the front page (ie the multi)

var anonSays = (function(){
    var retObject = {};
    retObject.currentPageSubreddits = (function(){
        var url = window.location.href.toLowerCase();
        var subredditsString = url.slice(url.indexOf('/r/') + 3, -1);
        return subredditsString.split('+');
    })();
    
    document.querySelector('.redditname').firstChild.innerHTML;

    //hide list of included subreddits on the multi page
    if (retObject.currentPageSubreddits.length != 1){
        document.querySelector('div.sidecontentbox').style.display = 'none';
    }

    //message controller
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.request){
            if (message.request === 'current_subreddits'){
                sendResponse({
                    current_subreddits: retObject.currentPageSubreddits,
            });
            }
        }
    });

    return retObject;
})();