// Tipue Search Lite
// Licensed under the MIT license. See the LICENSE file for details.

// list from http://www.ranks.nl/stopwords
const commonTerms = ["a", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves"];

window.onload = function execute(){
    var set = {
        "contextLength": 200,
        "showContext": true,
        "showTime": true,
        "showURL": false
    };

    var originalDocumentTitle = document.title;
    let params = new URLSearchParams(document.location.search.substring(1));

    // call search (if opened as a link)
    if (params.get("q")) {
        document.getElementById("tipue_search_input").value = params.get("q");
        getTipueSearch();
    }

    // search via search-box
    document.getElementById('tipue_search_input').form.onsubmit = function() {
        getTipueSearch();
        let historyUrl = '';
        let historyTitle = '';
        let query = document.getElementById("tipue_search_input").value;
        if (query) {
            historyUrl = historyUrl + '?q=' + query;
            historyTitle = 'Search - ' + query;
        } else {
            historyUrl = location.href.split('?')[0];
        }
        // add to address bar and history
        history.pushState({}, historyTitle, historyUrl);
        return false;
    };

    function getTipueSearch() {
        const startTimer = new Date().getTime();
        let results = [];
        let resultsHTML = "";
        let searchTerms = parseQuery(document.getElementById("tipue_search_input").value);
        let commonTermHits = commonTerms.filter(item => searchTerms.includes(item));
        searchTerms = searchTerms.filter(item => !commonTermHits.includes(item));
        results = getSearchResults(searchTerms, tipuesearch);
        document.title = "(" + results.length + ") " + originalDocumentTitle;

        // build HTML for each result
        for (const r of results) {
            resultsHTML += "<div class='tipue_search_result'>";
            resultsHTML += "<div class='tipue_search_content_title'><a href='" + r.url + "'>" + r.title + "</a></div>";
            if (set.showURL) {
                resultsHTML += "<div class='tipue_search_content_url'><a href='" + r.url + "'>" + r.url + "</a></div>";
            }
            // modify results and add to html output
            if (r.text && set.showContext) {
                let pageText = selectPageContext(r.text, searchTerms);
                pageText = highlightSearchTerms(pageText, searchTerms);
                resultsHTML += "<div class='tipue_search_content_text'>" + pageText + "</div>";
            }
            if (r.note) {
                resultsHTML += "<div class='tipue_search_note'>" + r.note + "</div>";
            }
            resultsHTML += "</div>";
        }
        // add information to beginning of the output
        resultsHTML = buildResultsInfo(results, startTimer, commonTermHits) + resultsHTML;
        // give the page the actual contents, which were build up
        document.getElementById("tipue_search_content").innerHTML = resultsHTML;
    }

    function buildResultsInfo(results, startTimer, commonTermHits) {
        let resultsInfo = ""
        if (results.length == 1) {
            resultsInfo += "<div id='tipue_search_results_count'>1 result";
        } else {
            resultsInfo += "<div id='tipue_search_results_count'>" + results.length + " results";
        }
        // display search time
        if (set.showTime) {
            const endTimer = new Date().getTime();
            const time = (endTimer - startTimer) / 1000;
            resultsInfo += " (" + time.toFixed(2) + " seconds)";
        }
        resultsInfo += "</div>";
        if (commonTermHits.length > 0) {
            resultsInfo += "<div id='tipue_ignored_words'>Common words \"" + commonTermHits.join(", ") + "\" got ignored.</div>";
        }
        return resultsInfo;
    }

    function getSearchResults(searchTerms, tipueIndex) {
        let results = [];
        for (const page of tipueIndex.pages) {
            let score = scoreText(searchTerms, page.title) + scoreText(searchTerms, page.text);
            if (score != 0) {
                page.score = score;
                results.push(page);
            }
        }
        results.sort(function(a, b) { return b.score - a.score });
        return results;
    }

    function parseQuery(query) {
        let searchTerms = [];
        while (query.length > 0) {
            query = query.trim();
            if (query.charAt(0) == '"' && query.includes('"', 1)) {
                end = query.indexOf('"', 1);
                searchTerms.push(query.slice(1, end));
                query = query.slice(end + 1);
            } else if (query.charAt(0) == "'" && query.includes("'", 1)) {
                end = query.indexOf("'", 1);
                searchTerms.push(query.slice(1, end));
                query = query.slice(end + 1);
            } else if (query.includes(" ", 1)) {
                end = query.indexOf(" ", 1);
                searchTerms.push(query.slice(0, end));
                query = query.slice(end + 1);
            } else {
                searchTerms.push(query);
                query = '';
            }
        }
        searchTerms = searchTerms.filter(item => (item));
        searchTerms = searchTerms.map(searchTerm => searchTerm.toLowerCase());
        // remove duplicates
        searchTerms = [...new Set(searchTerms)];
        return searchTerms;
    }

    function selectPageContext(pageText, searchTerms) {
        let tempText = pageText;
        let bestText = tempText.slice(0, set.contextLength);
        let bestScore = 0;
        while (tempText.length > 0) {
            let currentText = tempText.slice(0, set.contextLength);
            currentText = currentText.slice(0, currentText.lastIndexOf(" "));
            let score = scoreText(searchTerms, currentText);
            if (score > bestScore) {
                bestScore = score;
                bestText = currentText;
            }
            // check, otherwise endless loop
            if (tempText.indexOf(" ") > -1) {
                tempText = tempText.slice(tempText.indexOf(" ") + 1);
            } else {
                tempText = "";
            }
        }
        if (pageText.length > set.contextLength) {
            if (pageText.slice(0, bestText.length) == bestText) {
                return bestText + " ...";
            } else {
                return "... " + bestText + " ...";
            }
        }
        return bestText;
    }

    function highlightSearchTerms(partialPageText, searchTerms) {
        for (const term of searchTerms) {
            let patr = new RegExp("(" + term + ")", "gi");
            partialPageText = partialPageText.replace(patr, "<span class=\"fw-bold\">$1</span>");
        }
        return partialPageText;
    }

    function scoreText(searchTerms, text) {
        let score = 0;
        for (const term of searchTerms) {
            let numMatches = text.toLowerCase().split(term).length - 1;
            score += numMatches * term.length;
        }
        return score;
    }
}