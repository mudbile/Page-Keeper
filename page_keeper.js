//handles page-specific functions
//  * storing subreddit of page
//  * hiding some elements in the front page (ie the multi)

var pageKeeper = (function(){
    var retObject = {};
    retObject.subreddits = null;
    
    retObject.gettingCurrentPageSubreddits = function(){
        var url = window.location.href;
        var subredditsFromThusURL = this.getSubredditsFromWithinUrl(url);
        //case 1: url contains subreddit info
        if (subredditsFromThusURL){
            this.subreddits = subredditsFromThusURL;
            return Promise.resolve(subredditsFromThusURL);
        }
        //case 2: get list of multi subreddits from api
        else{
            if (url.indexOf('/m/') !== -1){
                return browser.runtime.sendMessage({request: 'multi_subreddits', url: url}).then(response => {
                    retObject.subreddits = response.multi_subreddits;
                    return response.multi_subreddits;
                });
            }
        }
    };
    
    //hide list of included subreddits on the multi page
    retObject.hideSideFrame = function(){
        var url = window.location.href;
        var subredditsFromThusURL = this.getSubredditsFromWithinUrl(url)
        if (subredditsFromThusURL && subredditsFromThusURL.length !== 1){
            document.querySelector('div.sidecontentbox').style.display = 'none';
        }
    };

    //returns null if there are none to give
    retObject.getSubredditsFromWithinUrl = function(url){
        if (retObject.subreddits){
            return retObjects.subreddits;
        } 
        //go from after the /r/ part
        var startIndex = url.indexOf('/r/') + '/r/'.length;
        var endIndex;
        var subredditsString;
        //if /r/ wasn't found, return null
        //otherwise go until next '/' or end of url
        if (startIndex - '/r/'.length !== -1){
            var endIndex = url.indexOf('/', startIndex);
            if (endIndex === -1){
                endIndex = url.length;
            }
            subredditsString = url.slice(startIndex, endIndex);
            return subredditsString.split('+');
        } else {
            return null;
        }
    }
    //message controller
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.request){
            if (message.request === 'current_subreddits'){
                if (retObject.subreddits){
                    sendResponse({current_subreddits: retObject.subreddits});
                } else {
                    var getting = retObject.gettingCurrentPageSubreddits();
                    return getting.then(ret => {
                        return {current_subreddits: ret}
                    });
                }   
            }
        }
    });
    return retObject;
})();



pageKeeper.hideSideFrame();