//handle displaying / hiding subscription details
document.getElementById('subscription-details-toggle').addEventListener('click', eventContext => {
    var subscriptionDetails = document.getElementById('subscription-details');
    if (!subscriptionDetails.style.display || subscriptionDetails.style.display === 'none'){
        subscriptionDetails.style.display = 'inline';
    } else {
        subscriptionDetails.style.display = 'none';
    }
});

var addSubredditFromTextbox = function(){
    var genericAddTextbox = document.getElementById('generic-add-textbox');
    if (genericAddTextbox.value !== ''){
        addingSubreddit(genericAddTextbox.value);
    }
}

document.getElementById('generic-add-button').addEventListener('click', addSubredditFromTextbox);
document.getElementById('generic-add-textbox').addEventListener('keyup', eventContext => {
    if (eventContext.key === 'Enter' ) {
        addSubredditFromTextbox();
        document.getElementById('generic-add-textbox').value = '';
    }
});

//dynamically creats a table of subscribed subreddits and inserts into popup dom
var createSubscriptionsTable = function(subredditNames){
    var subscriptionList = document.getElementById('subscription-list');
    //message for no subreddits
    if (subredditNames.length === 0){
        subscriptionList.innerHTML = "no subscriptions yet";
        return;
    }

    subscriptionList.innerHTML = null;
    var baseUrl = 'https://www.reddit.com/r/';

    //init table
    var subscriptionsTable = document.createElement('table');
    subscriptionsTable.id = 'subscription-table';
    subscriptionList.appendChild(subscriptionsTable);
    //process each subredditName -> each row
    subredditNames.forEach((subredditName, index) => {
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
        col1.firstElementChild.setAttribute("href", baseUrl + subredditName + '/'); 
        col1.firstElementChild.innerHTML = subredditName;
        //remove button
        var col2 = document.createElement('td');
        col2.classList.add('col-2');
        col2.appendChild(document.createElement('button'));
        col2.firstElementChild.classList.add('subscription-list-remove');
        col2.firstElementChild.setAttribute("type", "button");
        col2.firstElementChild.innerHTML = "remove";
        col2.addEventListener('click', eventContext => {removingSubreddit(subredditName)});
        //attach
        row.appendChild(col1);
        row.appendChild(col2);
        subscriptionsTable.appendChild(row);
    });

}

//update subscription list from background.js and rebuild table
var updatingSubscriptions = function(){
    var sending = browser.runtime.sendMessage({request : 'subscription_list'});
    return sending.then(response => {
        if (response.subscription_list){
            createSubscriptionsTable(response.subscription_list);
        }
    });
}


//called by remove buttons in the table of subscribed subreddits
//rebuilds whole table - could implement a caching system on this end
var removingSubreddit = function(subredditName){
    var sending = browser.runtime.sendMessage({action : 'remove_subreddit', subreddit_name: subredditName});
    return sending.then(response => {
        if (response.subscription_list){
            createSubscriptionsTable(response.subscription_list);
        }
    });
}

//called by add button next to textbox for adding a subreddit by name
//rebuilds whole table - could implement a caching system on this end
var addingSubreddit = function(subredditName){
    var sending = browser.runtime.sendMessage({action : 'add_subreddit', subreddit_name: subredditName});
    return sending.then(response => {
        if (response.subscription_list){
            createSubscriptionsTable(response.subscription_list);
        }
    });
}

updatingSubscriptions();







