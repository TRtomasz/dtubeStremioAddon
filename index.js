var Stremio = require("stremio-addons");
var https = require('https');
var request = require('request');
var steemjs = require('steem');
//var client = require('redis').createClient(process.env.REDIS_URL);
steemjs.api.setOptions({ url: 'https://api.steemit.com' });

// Enable server logging for development purposes
process.env.STREMIO_LOGGING = true; 

// Define manifest object
var manifest = { 
    // See https://github.com/Stremio/stremio-addons/blob/master/docs/api/manifest.md for full explanation
    id: "org.stremio.dtube",

    name: "dTube",
     version: "1.0.3",
    description: "dTube addon for stremio - monetize your videos with steem blockchain Join us at www.steemit.com",
    //icon: "https://d.tube/DTube_files/images/dtubeplay.png",
    logo: "https://d.tube/DTube_files/images/DTube_Black.svg",
    background: "https://image.ibb.co/buY5nw/Screenshot_3.png",
    contactEmail: "steem@steem.com",
    // Properties that determine when Stremio picks this add-on
    types: ["channel"], // your add-on will be preferred for those content types
    idProperty: ["dtube_id"], // the property to use as an ID for your add-on; your add-on will be preferred for items with that property; can be an array
    // We need this for pre-4.0 Stremio, it's the obsolete equivalent of types/idProperty
    filter: { "query.dtube_id": { "$exists": true }, "query.type": { "$in": ["channel"] } },
    endpoint : "http://secret-anchorage-23982.herokuapp.com/stremioget/stremio/v1",
    // Adding a sort would add a tab in Discover and a lane in the Board for this add-on
    sorts: [ {prop: "popularities.dtube", name: "dTube", types: ["channel"]}],
    listedOn: ["web", "desktop", "android", "ios"],
    isFree: true
};

var dataset = {

};

gateways = [
      "https://ipfs.infura.io",
      "https://ipfs.io",
      "https://gateway.ipfs.io",
      "https://scrappy.i.ipfs.io",
      "https://chappy.i.ipfs.io"
    ];
   function gatewayByHash(ipfsHash) {
    var g = ipfsHash.charCodeAt(ipfsHash.length-1) % gateways.length
    return gateways[g].split('://')[1]
  }

  function linkByHash(ipfsHash) {
    return 'https://'+gatewayByHash(ipfsHash)+'/ipfs/'+ipfsHash
  }

//client.on('connect', function() {
 //   console.log('connected');
//});

var methods = { };
function getVideoByIdWithCallback(id,callback)
{
    req = `https://api.asksteem.com/search?q=meta.video._id:${id}&types=post&include=meta`;
    request(req, function(e,r,b){
        if(!e && r.statusCode == 200)
        {
            var videos = (JSON.parse(b)).results;
            if(videos.length != 0)
            {
                console.log(videos);
                var video = 
                            {
                                id: videos[0].meta.video._id,
                                title: videos[0].title,
                                publishedAt: new Date(videos[0].created),
                                thumbnail: 'https://snap1.d.tube/ipfs/'+videos[0].meta.video.info.snaphash,
                                stream: 
                                {
                                    url: videos[0].meta.video.content.video480hash ? linkByHash(videos[0].meta.video.content.video480hash) : linkByHash(videos[0].meta.video.content.videohash),
                                    name: videos[0].author,
                                    title: videos[0].title,
                                    isFree: true,
                                    availability: 0
                                },
                                overview: videos[0].summary
                            };
                callback(null,[video.stream]);
            }
            else
                callback(null,[]);3
        }
        else
        {
            callback(new Error("Steem ASK ERROR"),[]);
        }
    });
}
function loadPaginatedVideos(users,counter,callback,page,maxAmount,returnArr)
{
    if(counter >= users.length)
    {
        if(returnArr){
            users.sort(function(a,b){
                a.popularities - b.popularities;
            })
            callback(null,users);
        }
        else{
            callback(null,users[0]);
        }
    }
    else {
    var req = `https://api.asksteem.com/search?q=author:${users[counter].name}+AND+tags:dtube+AND+meta.video.info.title:*&types=post&include=meta&sort_by=created&order=desc&pg=${page}`;
    request(req, function(e,r,b){
        if(!e && r.statusCode == 200)
        {
            var videos = (JSON.parse(b)).results;
            var pages = (JSON.parse(b)).pages;
            var user = users[counter];
                    if(videos.length != 0){
                        for(i = 0, j = videos.length; i < j; i++)
                        {

                            var video = 
                            {
                                id: videos[i].meta.video._id,
                                title: videos[i].title,
                                publishedAt: new Date(videos[i].created),
                                thumbnail: 'https://snap1.d.tube/ipfs/'+videos[i].meta.video.info.snaphash,
                                stream: 
                                {
                                    url: videos[i].meta.video.content.video480hash ? linkByHash(videos[i].meta.video.content.video480hash) : linkByHash(videos[i].meta.video.content.videohash),
                                    name: user.name,
                                    title: videos[i].title,
                                    isFree: true,
                                    availability: 0
                                },
                                overview: videos[i].summary
                            }
                            user.videos.push(video);
                        }
                        if(!pages.has_next || user.videos.length >= maxAmount){
                            loadPaginatedVideos(users,counter+1,callback,1,maxAmount,returnArr);
                        }
                        else {
                            loadPaginatedVideos(users,counter,callback,page+1,maxAmount,returnArr);
                        }
                    }
                    else
                    {
                        loadPaginatedVideos(users,counter+1,callback,1,maxAmount,returnArr);
                    }
        }
        else
        {
            //error steemask
            console.log(e,"blad steeemask");
            callback(new Error("Steemask error"),[]);
        }
    });
}
}
function createChannelFromAuthorName(author, callback, returnArr,search)
{
    console.log(author.length);
    var users = [];
    steemjs.api.setOptions({ url: 'https://api.steemit.com' });
    steemjs.api.getAccounts(author, function(err,result){
        if(!err) {
            if (result.length == 0)
                return callback();
            for(var ii =0, jj = result.length; ii < jj; ii++) {
            var user = {};    
            var data = result[ii];
            if(data.json_metadata !== ''){
                var meta = JSON.parse(data.json_metadata);
            }
            else
                var meta = { profile: { profile_image: "", cover_image: "", about: ""}};
            if (typeof meta.profile === "undefined")
                meta.profile = {about: ""};
            user.id = "dtube_id:"+data.name;
            user.name = data.name;
            user.poster = 'https://img.busy.org/'+'@'+data.name;
            user.posterShape = "regular";
            user.banner = 'https://img.busy.org/'+'@'+data.name;
            user.background = meta.profile.cover_image;
            user.website = "www.steemit.com/@"+data.name,
            user.genre = ["Entertainment"];
            user.description = "Visit me at " + "www.steemit.com/@"+data.name + " "+  meta.profile.about? meta.profile.about : ":)";
            user.isFree = 1;
            user.popularity = data.reputation;
            user.popularities = {dTube: data.reputation};
            user.type = "channel";
            user.videos = [];
            users.push(user);
        }
        if(!returnArr){
                loadPaginatedVideos(users,0,callback,1,50,returnArr);
        }
        else
        {
            users.sort(function(a,b){
                return b.popularity - a.popularity;
            });
            if(!search){
                callback(null,users);

            }
            else{
                callback(null,{query: users[0].name, results: users});
            }
        }
    }
    else
    {
        console.log("blad steemjs", err);
        callback(new Error("Steemjs error"),[]);
    }
    });
}

function loadPaginatedUsersWith(usersList,page,maxAmount,callback)
{
    var reqNew = `https://api.asksteem.com/search?q=tags:dtube+AND+meta.video.info.title:*&types=post&include=meta&sort_by=created&order=desc&pg=${page}`;
            request(reqNew, function (e,r,b) {
            if (!e && r.statusCode == 200)
            {
                var newPosts = (JSON.parse(b)).results;
                var pages = (JSON.parse(b)).pages;
                var authors  = newPosts.map(function(x){
                    return x.author;
                });
                usersList = usersList.concat(authors);
                if(!pages.has_next || usersList.length >= maxAmount)
                    createChannelFromAuthorName(usersList,callback,true,false);
                else
                    loadPaginatedUsersWith(usersList,page+1,maxAmount,callback);
            }
        });
}
var addon = new Stremio.Server({
    "stream.find": function(args, callback) {
        console.log("received request from stream.find", args);
        if (! args.query) return callback();
        getVideoByIdWithCallback(args.query.video_id,callback);
    },
    "meta.find": function(args, callback) {
        console.log("received request from meta.find", args)
        if (! args.query) return callback(new Error("no query"));
        var page = ((args.skip || 0))/10 + 1;
        console.log("Page ", page);
        loadPaginatedUsersWith([],page,70,callback);
    },
    "meta.get": function(args, callback) {
        console.log("received request from meta.get", args, args.query.dtube_id);
        if (! args.query) return callback();
        createChannelFromAuthorName([args.query.dtube_id],callback,false,false);
    },
    "meta.search": function(args, callback) {
        console.log("received request from meta.search", args)
        if (! args.query) return callback();
        createChannelFromAuthorName([args.query],callback,true,true);
    },
}, manifest);

if (require.main===module) var server = require("http").createServer(function (req, res) {
    addon.middleware(req, res, function() { res.end() }); // wire the middleware - also compatible with connect / express
}).on("listening", function()
{
    var port = server.address().port;
    console.log("dtube Stremio Addon listening on "+port);
    console.log("starting")
}).listen(process.env.PORT || 7000);

// Export for local usage
module.exports = addon;