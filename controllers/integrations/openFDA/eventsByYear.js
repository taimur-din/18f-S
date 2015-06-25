   'use strict';
var https = require('https');
var url = require('url');

var drugEventRequest = require('../../../models/openFDA/drugEventRequest');
var drugEventResponse = require('../../../models/openFDA/drugEventResponse');

module.exports = function (router) {

   /*
     * Drug Events Search
     */
    router.get('/', function (req, res) {
        var apiKey = req.app.kraken.get('integrations').openFDA.apiKey;

        var model = new drugEventRequest(req.query, apiKey);
        var options = {
            protocol: 'https:',
            hostname: req.app.kraken.get('integrations').openFDA.hostname, //'api.fda.gov',
            pathname: req.app.kraken.get('integrations').openFDA.endpoints.drug.event
        };

        var formattedUrl;
        var replyCount = 0;
        var body1, body2;

        options.search = model.totalsQuery();
        formattedUrl = url.format(options);
        console.log(formattedUrl);
        //req1
        console.time('openFDA [event totals search]');
        var fdaReq1 = https.get(formattedUrl, function(searchRes) {
            var body = '';

            searchRes.setEncoding('utf8');
            searchRes.on('data', function(chunk) {
                body += chunk;
            });
            
            searchRes.on('end', function() {
                console.timeEnd('openFDA [event totals search]');
                body1 = body;
                replyCount++;

                if (searchRes.statusCode === 200) {
                    if (replyCount === 2) {
                        combineEventReplies(model.year, body1, body2, res);
                    }
                } else if (searchRes.statusCode === 404) {
                    //no results found
                    if (replyCount !== 2) {
                        //cancel second request if active
                        fdaReq2.abort();
                    }
                    combineEventReplies(model.year, body1, body2, res);
                } else if (searchRes.statusCode === 429) {
                    //rate-limited
                } else {
                    if (replyCount !== 2) {
                        fdaReq2.abort();
                    }
                    res.send({ 'error': { 'code': searchRes.statusCode, 'message': 'Unexpected Error' } });
                }
            });
        }).on('error', function(e) {
            console.log('ERROR: '  + e.message);
        });


        options.search = model.eventsQuery();
        formattedUrl = url.format(options);
        console.log(formattedUrl);
        //req2
        console.time('openFDA [events search]');
        var fdaReq2 = https.get(formattedUrl, function(searchRes) {
            var body = '';

            searchRes.setEncoding('utf8');
            searchRes.on('data', function(chunk) {
                body += chunk;
            });
            
            searchRes.on('end', function() {
                console.timeEnd('openFDA [events search]');
                body2 = body;
                replyCount++;

                if (searchRes.statusCode === 200) {
                    if (replyCount === 2) {
                        combineEventReplies(model.year, body1, body2, res);
                    }
                } else if (searchRes.statusCode === 404) {
                    //no results found
                    if (replyCount !== 2) {
                        //cancel second request if active
                        fdaReq1.abort();
                    }
                    combineEventReplies(model.year, body1, body2, res);
                } else if (searchRes.statusCode === 429) {
                    //rate-limited
                } else {
                    if (replyCount !== 2) {
                        fdaReq1.abort();
                    }
                    res.send({ 'error': { 'code': searchRes.statusCode, 'message': 'Unexpected Error' } });
                }    
            });
        }).on('error', function(e) {
            console.log('ERROR: '  + e.message);
        });
    });

    function combineEventReplies(year, body1, body2, res) {
        //console.log(body1);
        //console.log(body2);
        var bodyObject = (body1 !== undefined) ? JSON.parse(body1) : null;
        var eventsObject = (body2 !== undefined) ? JSON.parse(body2) : null;

        var total = (bodyObject === null || bodyObject.error !== undefined) ?
            0 : bodyObject.meta.results.total;

        var drugEvents = (eventsObject === null || eventsObject.error !== undefined) ?
            [] : eventsObject.results;

        var responseObject = { year: year, total: total, events: drugEvents };
        res.send(responseObject);

    }
};