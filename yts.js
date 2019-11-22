/**
 * YTS plugin for Movian Media Center
 *
 *  Copyright (C) 2015-2018 lprot
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

var page = require('showtime/page');
var service = require('showtime/service');
var settings = require('showtime/settings');
var http = require('showtime/http');
var string = require('native/string');
var plugin = JSON.parse(Plugin.manifest);
var logo = Plugin.path + plugin.icon;

RichText = function(x) {
    this.str = x.toString();
}

RichText.prototype.toRichString = function(x) {
    return this.str;
}

var blue = '6699CC', orange = 'FFA500', red = 'EE0000', green = '008B45';

function coloredStr(str, color) {
    return '<font color="' + color + '">' + str + '</font>';
}

function setPageHeader(page, title) {
    if (page.metadata) {
        page.metadata.title = title;
        page.metadata.logo = logo;
    }
    page.type = "directory";
    page.contents = "items";
    page.entries = 0;
    page.loading = true;
}

var genres = [
    "Action", "Adventure", "Animation", "Biography", "Comedy", "Crime",
    "Documentary", "Drama", "Family", "Fantasy", "Film-Noir", "History",
    "Horror", "Music", "Musical", "Mystery", "Romance", "Sci-Fi", "Short",
    "Sport", "Thriller", "War", "Western"];

service.create(plugin.title, plugin.id + ":start", 'video', true, logo);

settings.globalSettings(plugin.id, plugin.title, logo, plugin.synopsis);
settings.createBool('enableMetadata', 'Enable metadata fetching', false, function(v) {
    service.enableMetadata = v;
});
settings.createString('baseURL', "Base URL without '/' at the end", 'https://yts.lt', function(v) {
    service.baseUrl = v;
});

function concat(what) {
    var s = 0;
    for (var i in what)
        (s ? s+= ', ' + what[i] : s = what[i]);
    return s;
}

function concatEntity(entity, field) {
    var s = 0;
    for (var i in entity)
        (s ? s += ', ' + entity[i][field] : s = entity[i][field]);
    return s;
}

function browseItems(page, query, count) {
    var offset = 1;
    page.entries = 0;

    function loader() {
        if (!offset) return false;
        page.loading = true;

        var args = {
            limit: 40,
            page: offset,
            quality: service.quality,
            sort_by: service.sorting,
            order_by: service.order
        };
        for (var i in query)
            args[i] = unescape(query[i]);

        try {
            var c = JSON.parse(http.request(service.baseUrl + '/api/v2/list_movies.json', {
                args: args
            }));
        } catch(err) {
            page.error('Seems like API stopped working/changed or website is down. Check that in the browser...');
            return;
        }

        page.loading = false;
        if (offset == 1 && page.metadata && c.data.movie_count)
            page.metadata.title;
        for (var i in c.data.movies) {
            addMovieItem(page, c.data.movies[i]);
            if (count && page.entries > count) return offset = false;
        }
        offset++;
        return c.data.movies && c.data.movies.length > 0;
    }
    loader();
    page.paginator = loader;
    page.loading = false;
}

new page.Route(plugin.id + ":genre:(.*)", function(page, genre) {
    setPageHeader(page, genre);
    browseItems(page, {
        genre: genre
    });
    page.loading = false;
});

new page.Route(plugin.id + ":genres", function(page, genre) {
    setPageHeader(page, 'Genres');
    for(var i in genres) {
        var item = page.appendItem(plugin.id + ":genre:" + genres[i], "directory", {
            title: genres[i]
        });
    }
    page.loading = false;
});

new page.Route(plugin.id + ":newest", function(page) {
    setPageHeader(page, 'Newest');
    browseItems(page, {
        sort: 'peers'
    });
    page.loading = false;
});

function constructMultiopt(multiOpt, storageVariable) {
    var t = [
        ['ALL', 'All'],
        ['1080p', '1080p'],
        ['720p', '720p'],
        ['3D', '3D']
    ];
    if (!storageVariable)
        multiOpt[0][2] = true;
    else
        for (var i = 0; i < multiOpt.length; i++) {
            if (multiOpt[i][0] == storageVariable) {
                multiOpt[i][2] = true;
                break;
            }
        }
    return multiOpt;
}

function addOptions(page) {
    var optionsAreAdded = false;
    var options = constructMultiopt([['ALL', 'All'],
        ['1080p', '1080p'],
        ['720p', '720p'],
        ['3D', '3D']], service.quality);
    page.options.createMultiOpt('filter', "Filter quality by", options, function(v) {
        service.quality = v;
        if (optionsAreAdded) {
            page.flush();
            processStartPage(page);
        }
    });

    options = constructMultiopt([
        ['date_added', 'Date'],
        ['seeds', 'Seeds'],
        ['peers', 'Peers'],
        ['like_count', 'Like Count'],
        ['title', 'Title'],
        ['rating', 'Rating'],
        ['downloaded_count', 'Downloaded Count'],
        ['year', 'Year']], service.sorting);
    page.options.createMultiOpt('sorting', "Sort results by", options, function(v) {
        service.sorting = v;
        if (optionsAreAdded) {
            page.flush();
            processStartPage(page);
        }
    });

    options = constructMultiopt([
        ['desc', 'Descending'],
        ['asc', 'Ascending']], service.order);
    page.options.createMultiOpt('order', "Order by", options, function(v) {
        service.order = v;
        if (optionsAreAdded) {
            page.flush();
            processStartPage(page);
        }
    });
    optionsAreAdded = true;
}

function processStartPage(page) {
    page.appendItem(plugin.id + ":genres", "directory", {
        title: 'Genres'
    });
    page.appendItem("", "separator", {
        title: 'Newest'
    });
    browseItems(page, {
        sort: 'date'
    }, 7);
    page.appendItem(plugin.id + ':newest', 'directory', {
        title: 'More ►'
    });
    page.appendItem("", "separator", {
        title: 'The most popular'
    });
    browseItems(page, {
        sort: 'peers'
    });
    page.loading = false;
}

new page.Route(plugin.id + ":start", function(page) {
    setPageHeader(page, plugin.synopsis);
    page.appendItem(plugin.id + ":search:", 'search', {
        title: 'Search at ' + service.baseUrl
    });
    addOptions(page);
    processStartPage(page);
});

new page.Route(plugin.id + ":list:(.*)", function(page, query) {
    setPageHeader(page, 'Filter by: ' + unescape(query));
    browseItems(page, {
        query_term: query
    });
    page.loading = false;
});

function addMovieItem(page, mov) {
    var item = page.appendItem(plugin.id + ':movie:' + mov.id, "video", {
        title: new RichText(mov.title + ' ' + coloredStr(concatEntity(mov.torrents, 'quality'), orange)),
        icon: mov.medium_cover_image,
        year: +mov.year,
        rating: mov.rating * 10,
        duration: +mov.runtime,
        genre: concat(mov.genres),
        description: new RichText(coloredStr('Seeds: ', orange) + coloredStr(concatEntity(mov.torrents, 'seeds'), green) +
            coloredStr('\nPeers: ', orange) + coloredStr(concatEntity(mov.torrents, 'peers'), red) + ' ' +
            coloredStr('\nUploaded: ', orange) + concatEntity(mov.torrents, 'date_uploaded') +
            coloredStr('\nSize: ', orange) + concatEntity(mov.torrents, 'size') +
            coloredStr('\nMPA rating: ', orange) + mov.mpa_rating +
            coloredStr('\nLanguage: ', orange) + mov.language +
            coloredStr('\nState: ', orange) + mov.state
        )
    });
    page.entries++;
    if (service.enableMetadata) {
        item.bindVideoMetadata({
            imdb: mov.imdb_code
        });
    }
}

new page.Route(plugin.id + ":movie:(.*)", function(page, id) {
    page.loading = true;
    var json = JSON.parse(http.request(service.baseUrl + '/api/v2/movie_details.json?movie_id=' + id + '&with_images=true&with_cast=true'));
    setPageHeader(page, json.data.movie.title_long);
    if (page.metadata.background && json.data.movie.background_image) {
        page.metadata.background = json.data.movie.background_image;
        page.metadata.backgroundAlpha = 0.3;
    }
    for (var i in json.data.movie.torrents) {
        var link = json.data.movie.torrents[i].url.match(/(\/torrent\/download(.*))/);
        if (link)
            link = service.baseUrl.replace('/api/', '') + link[1];
        else
            link = json.movie.torrents[i].url;
        var vparams = "videoparams:" + JSON.stringify({
            title: json.data.movie.title,
            canonicalUrl: plugin.id + ':movie:' + id + ':' + json.data.movie.torrents[i].quality,
            imdbid: json.data.movie.imdb_code,
            no_fs_scan: true,
            sources: [{
                url: 'torrent:video:' + link
            }]
        });

        page.appendItem(vparams, "video", {
            title: new RichText(coloredStr(json.data.movie.torrents[i].quality, orange) + ' ' + json.data.movie.title),
            year: +json.data.movie.year,
            duration: json.data.movie.runtime * 60,
            rating: +json.data.movie.rating * 10,
            icon: json.data.movie.medium_cover_image,
            genre: concat(json.data.movie.genres),
            backdrops: [{url: json.data.movie.large_screenshot_image1},{url: json.data.movie.large_screenshot_image2},{url: json.data.movie.large_screenshot_image3}],
            tagline: new RichText(coloredStr('Seeds: ', orange) + coloredStr(json.data.movie.torrents[i].seeds, green) +
            coloredStr(' Peers: ', orange) + coloredStr(json.data.movie.torrents[i].peers, red) + ' ' +
                (json.data.movie.like_count ? coloredStr('Likes: ', orange) + json.data.movie.like_count : '') +
                (json.data.movie.download_count ? coloredStr(' Downloads: ', orange) + json.data.movie.download_count : '') +
                (json.data.movie.mpa_rating ? coloredStr(' MPA rating: ', orange) + json.data.movie.mpa_rating : '')),
            description:  new RichText(coloredStr('Language: ', orange) + json.data.movie.language +
                coloredStr(' Added: ', orange) + json.data.movie.torrents[i].date_uploaded +
                (json.data.movie.torrents[i].resolution ? coloredStr('<br>Resolution: ', orange) + json.data.movie.torrents[i].resolution + 'x' + json.data.movie.torrents[i].framerate + 'fps' : '') +
                coloredStr(' Size: ', orange) + json.data.movie.torrents[i].size +
                (json.data.movie.description_full ? '<br>' + json.data.movie.description_full : ''))
        });
    }
    if (json.data.movie.yt_trailer_code)
        page.appendItem('youtube:video:'+escape(json.data.movie.yt_trailer_code), "video", {
            title: 'Trailer',
            icon: json.data.movie.medium_cover_image
        });
    if (json.data.movie.large_cover_image)
        page.appendItem(json.data.movie.large_cover_image, "image", {
            title: 'Cover'
        });
    if (json.data.movie.large_screenshot_image1)
        page.appendItem(json.data.movie.large_screenshot_image1, "image", {
            title: 'Screenshot1'
        });
    if (json.data.movie.large_screenshot_image2)
        page.appendItem(json.data.movie.large_screenshot_image2, "image", {
            title: 'Screenshot2'
        });
    if (json.data.movie.large_screenshot_image3)
        page.appendItem(json.data.movie.large_screenshot_image3, "image", {
            title: 'Screenshot3'
        });
    if (json.data.movie.cast) {
        page.appendItem("", "separator", {
            title: 'Actors:'
        });
        for (var i in json.data.movie.cast) {
            page.appendPassiveItem('video', '', {
                title: json.data.movie.cast[i].name + ' as ' + json.data.movie.cast[i].character_name,
                icon: json.data.movie.cast[i].url_small_image
            });
        }
    }

    if (json.data.movie.directors) {
        page.appendItem("", "separator", {
            title: 'Directors:'
        });
        for (var i in json.data.movie.directors) {
            page.appendItem(plugin.id + ':list:' + escape(json.data.directors[i].name), "video", {
                title: json.data.directors[i].name,
                icon: json.data.directors[i].medium_image
            });
        }
    }

    // Suggestions
    try {
        json = JSON.parse(http.request(service.baseUrl + '/api/v2/movie_suggestions.json?movie_id=' + id));
        var first = true;
        for (var i in json.data.movies) {
            if (first) {
                page.appendItem("", "separator", {
                    title: 'Suggestions:'
                });
                first = false;
            };
            addMovieItem(page, json.data.movies[i]);
        }
    } catch(err) {}

    // Comments
    try {
        json = JSON.parse(http.request(service.baseUrl + '/api/v2/movie_comments.json?movie_id=' + id));
        first = true;
        for (var i in json.data.comments) {
            if (first) {
                page.appendItem("", "separator", {
                    title: 'Comments:'
                });
                first = false;
            };
            page.appendPassiveItem('video', '', {
                title: new RichText(coloredStr(json.data.comments[i].username, orange) + ' (' + json.data.comments[i].date_added + ')'),
                icon: json.data.comments[i].medium_user_avatar_image,
                description: new RichText(json.data.comments[i].comment_text +
                    coloredStr('\nLike Count: ', orange) + json.data.comments[i].like_count)
            });
        }
    } catch(err) {}
    page.loading = false;
});

new page.Route(plugin.id + ":search:(.*)", function(page, query) {
    setPageHeader(page, plugin.title);
    browseItems(page, {
        query_term: query
    });
});

page.Searcher(plugin.title, logo, function(page, query) {
    browseItems(page, {
        query_term: query
    });
});
