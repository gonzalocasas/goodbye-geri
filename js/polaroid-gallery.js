var polaroidGallery = (function () {
    var dataSize = {};
    var dataLength = 0;
    var currentData = null;
    var navbarHeight = 60;
    var resizeTimeout = null;
    var xmlhttp = new XMLHttpRequest();
    var dynamodb = new AWS.DynamoDB();
    var docClient = new AWS.DynamoDB.DocumentClient();

    function polaroidGallery(url) {
        observe();
        xmlhttp.onreadystatechange = function () {
            if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
                var myArr = JSON.parse(xmlhttp.responseText);
                setGallery(myArr);

                init();
            }
        };
        xmlhttp.open("GET", url, true);
        xmlhttp.send();
    }

    function setGallery(arr) {
        var out = "";
        var i;
        for (i = 0; i < arr.length; i++) {
            let picture_id = arr[i].name.replace('img/', '').replace('-thumb.png', '');
            out += '<div class="photo" id="' + i + '" data-pid="' + picture_id + '"><div class="side side-front"><figure>' +
                '<img src="' + arr[i].name + '" alt="' + arr[i].name + '"/>' +
                '<figcaption>' + arr[i].caption + '</figcaption>' +
                '</figure></div><div class="side side-back"><div><p>' + arr[i].description + '</p></div></div></div>';
        }
        document.getElementById("gallery").innerHTML = out;
    }

    function observe() {
        var observeDOM = (function () {
            var MutationObserver = window.MutationObserver || window.WebKitMutationObserver,
                eventListenerSupported = window.addEventListener;

            return function (obj, callback) {
                if (MutationObserver) {
                    var obs = new MutationObserver(function (mutations, observer) {
                        if (mutations[0].addedNodes.length || mutations[0].removedNodes.length)
                            callback(mutations);
                    });

                    obs.observe(obj, { childList: true, subtree: false });
                }
                else if (eventListenerSupported) {
                    obj.addEventListener('DOMNodeInserted', callback, false);
                }
            }
        })();

        observeDOM(document.getElementById('gallery'), function (mutations) {
            var gallery = [].slice.call(mutations[0].addedNodes);
            gallery.forEach(function (item) {
                var img = item.getElementsByTagName('img')[0];
                var fig = item.getElementsByTagName('figure')[0];
                var first = true;

                img.addEventListener('load', function () {
                    item.style.height = (fig.offsetHeight).toString() + 'px';
                    item.style.width = (fig.offsetWidth).toString() + 'px';

                    dataSize[item.id] = {item: item, width: item.offsetWidth, height: img.offsetHeight};

                    if (first) {
                        currentData = dataSize[item.id];
                        first = false;
                    }

                    dataLength++;

                    item.addEventListener('click', function () {
                        if ((currentData != dataSize[item.id]) || (currentData == null)) {
                            select(dataSize[item.id]);
                            shuffleAll();
                        } else {
                            item.classList.contains('flipped') === true ? item.classList.remove('flipped') : item.classList.add('flipped');
                        }
                    });

                    shuffle(dataSize[item.id]);
                })
            });
        });
    }

    function init() {
        navbarHeight = document.getElementById("nav").offsetHeight;
        navigation();

        window.addEventListener('resize', function () {
            if (resizeTimeout) {
                clearTimeout(resizeTimeout);
            }
            resizeTimeout = setTimeout(function () {
                shuffleAll();
                if (currentData) {
                    select(currentData);
                }
            }, 100);
        });
    }

    function select(data) {
        var scale = 1.8;

        var x = (window.innerWidth - data.item.offsetWidth) / 2;
        var y = (window.innerHeight - navbarHeight - data.item.offsetHeight) / 2;

        data.item.style.zIndex = 999;
        data.item.style.WebkitTransform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ',' + scale + ')';
        data.item.style.mozTransform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ',' + scale + ')';
        data.item.style.msTransform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ',' + scale + ')';
        data.item.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ',' + scale + ')';

        currentData = data;

        var vote_counter = document.getElementById('vote-counter');
        vote_counter.innerText = 0;

        readVotes(currentData.item.dataset.pid, function(item) {
            if (item && item.votes) {
                vote_counter.innerText = item.votes;
            }
        });
    }

    function shuffle(data) {
        var randomX = Math.random();
        var randomY = Math.random();
        var maxR = 45;
        var minR = -45;
        var rotRandomD = Math.random() * (maxR - minR) + minR;

        var x = Math.floor((window.innerWidth - data.item.offsetWidth) * randomX);
        var y = Math.floor((window.innerHeight - data.item.offsetHeight - navbarHeight) * randomY);

        data.item.style.zIndex = 1;
        data.item.style.WebkitTransform = 'translate(' + x + 'px,' + y + 'px) rotate(' + rotRandomD + 'deg)';
        data.item.style.mozTransform = 'translate(' + x + 'px,' + y + 'px) rotate(' + rotRandomD + 'deg)';
        data.item.style.msTransform = 'translate(' + x + 'px,' + y + 'px) rotate(' + rotRandomD + 'deg)';
        data.item.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + rotRandomD + 'deg)';
    }

    function shuffleAll() {
        for (var id in dataSize) {
            if (id != currentData.item.id) {
                shuffle(dataSize[id]);
            }
        }
    }

    function readVotes(picture_id, readCallback) {
        var params = {
            TableName: 'votes',
            Key: {
                "pid": picture_id
            }
        };
        docClient.get(params, function (err, data) {
            if (err) {
                alert("Unable to read item: " + "\n" + JSON.stringify(err, undefined, 2));
            } else {
                readCallback(data.Item)
            }
        });
    }


    function votePicture(picture_id) {
        var params = {
            TableName: 'votes',
            Key: {
                "pid": picture_id
            },
            UpdateExpression: "ADD votes :v",
            ExpressionAttributeValues: {
                ":v": 1,
            },
            ReturnValues: "UPDATED_NEW"
        };

        docClient.update(params, function (err, data) {
            if (err) {
                alert("Unable to update item: " + "\n" + JSON.stringify(err, undefined, 2));
            } else {
                console.log('All ok!');
                var vote_counter = document.getElementById('vote-counter');
                if (data.Attributes && data.Attributes.votes) {
                    vote_counter.innerText = data.Attributes.votes;
                }
            }
        });
    }

    function navigation() {
        var vote = document.getElementById('vote');
        var next = document.getElementById('next');
        var previous = document.getElementById('previous');

        vote.addEventListener('click', function () {
            votePicture(currentData.item.dataset.pid);
        });

        next.addEventListener('click', function () {
            var currentIndex = Number(currentData.item.id) + 1;
            if (currentIndex >= dataLength) {
                currentIndex = 0
            }
            select(dataSize[currentIndex]);
            shuffleAll();
        });

        previous.addEventListener('click', function () {
            var currentIndex = Number(currentData.item.id) - 1;
            if (currentIndex < 0) {
                currentIndex = dataLength - 1
            }
            select(dataSize[currentIndex]);
            shuffleAll();
        })
    }

    return polaroidGallery;
})();