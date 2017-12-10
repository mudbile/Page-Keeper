# Page Keeper

This web extension allows a user to keep a set of front pages for the reddit website, 
available to them without having to log in. It also generates front pages of random and pseudo random subreddits,
wth the interesting option of limiting to smaller/unknown subreddits.

You can create, remove, rename and duplicate 
front pages at any time. These are automatically saved for you, available any time you use 
your browser. To visit the front page, click “front page”. To add a subreddit by name, enter 
it into the textbox and press enter or click the “add” button to add it to the currently 
selected front page.

There are certain things with this web extension you can only do on reddit. For example, 
if you find yourself on a subreddit you like, you can click the “+” button in the top left
 corner of the extension to add that subreddit. Similarly, the button will be labelled “-“ 
 if that subreddit is already in the selected front page, and clicking it will remove the subreddit.
The other thing you can only do while on a reddit page is create a random front page. Do so 
by pressing “?” and note that if you exit the extension menu, the front page generation will
 cancel- so you have to wait a bit. You can set some settings that become visible by clicking
 on the “generator settings” button.
 
This extension provides two methods of subreddit collection. One method is random- similar to 
repeatedly pressing the “serendipity” button on reddit itself. The other is a guided search using 
a key word. Both methods are used together when generating a front page, with the total number of 
subreddits gathered split between the two methods according to their weights (given as two settings). 
The weights are relative, and can be 0 (although if both are 0 you won’t get any subreddits). So, for 
example, if the weight for seeded search is 2 and the weight for guided search is 1, you will get 2 
seeded-search subreddits for every random one. You can also exclude subreddits and check/uncheck the 
“allow nsfw” checkbox.

The cool thing is you can limit your subreddits to a given subscriber or active user limit, essentially 
restricting your search to smaller/unknown subreddits. This affects both random and guided searches, 
but keep in mind setting this smaller means longer search time (reddit’s api doesn’t seem to support 
this kind of search directly, so it really is just sifting through them until it gets the desired amount 
of subreddits).

Screenshot #1: settings:
![settings](/img/demo_settings.png)

Screenshot #2: results of a search	 
![results](/img/demo_results.png)