//handles page-specific functions
//  * storing subreddit of page
//  * hiding some elements in the front page (ie the multi)

var anonSays = (function(){
    var retObject = {};
    retObject.currentPageSubreddits = (function(){
        var url = window.location.href.toLowerCase();
        //  "https://www.reddit.com/r/<we want all of this>/blah/blah"
        var startIndex = url.indexOf('/r/') + 3;
        var endIndex = url.indexOf('/', startIndex);
        if (endIndex === -1){
            endIndex = url.length;
        }
        var subredditsString = url.slice(startIndex, endIndex);
        console.log("string is: " + subredditsString);
        return subredditsString.split('+');
    })();

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