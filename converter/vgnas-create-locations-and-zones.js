var fs = require('fs'), csv = require('csv'), async = require('async'), assert = require('assert');

var locations = {}, zones = {}, averageValues = {};

var convertCsv = function (filename, finalCallback) {
    var generateZoneId = function (line) {
        var idParts = [];
        var addIdPart = function (value) {
            if (value && idParts.indexOf(value) < 0) {
                idParts.push(value);
            }
        };

        addIdPart(line[0]);
        if (line[1]) {
            addIdPart(line[1]);
        }
        return idParts.join(' ');
    };

    var generateZoneValues = function (line) {
        if (!line[9]) {
            return null;
        }

        var convertNumericValue = function (value) {
            value = value.replace(/,/g, '.');
            if (value === 'k.A.') {
                value = '';
            }
            if (value === '' || value.indexOf('-') > -1) {
                return value;
            } else {
                var number = parseFloat(value, 10);
                if (isNaN(number)) {
                    console.log('is not a number: ' + value);
                }
                return isNaN(number) ? '' : number;
            }
        };

        return {
            "natrium": convertNumericValue(line[11]),
            "kalium": convertNumericValue(line[12]),
            "calcium": convertNumericValue(line[13]),
            "magnesium": convertNumericValue(line[14]),
            "mangan": convertNumericValue(line[15]),
            "ammonium": convertNumericValue(line[16]),
            "nitrat": convertNumericValue(line[17]),
            "sulfat": convertNumericValue(line[18]),
            "chlorid": convertNumericValue(line[19]),
            "fluorid": convertNumericValue(line[20]),
            "hardness": convertNumericValue(line[9]),
            "year": '2018',
            "description": line[21]
        };
    };

    var fillZones = function (line) {
        var zoneId = generateZoneId(line);
        var zoneValues = generateZoneValues(line);
        if (zoneValues && zoneValues.hardness) {
            if (zones[zoneId]) {
                try {
                    assert.deepEqual(zoneValues, zones[zoneId]);
                } catch (e) {
                    console.log('Werte innerhalb einer Zone unterschiedlich! ' + zoneId);
                }
            } else {
                zones[zoneId] = zoneValues;
            }
            fillLocations(line);
        }
    };

    var addProperty = function (parent, property, value, force) {
        if ((property || force) && !parent[property]) {
            parent[property] = value;
        }
    };

    var fillLocations = function (line) {
        addProperty(locations, line[0], {});
        addProperty(locations[line[0]], line[1], {});
    };

    var trimAll = function (line) {
        for (var column = 0; column < line.length; column++) {
            line[column] = line[column].trim();
        }
    };

    var convertLine = function (line) {
        if (line[1].indexOf('x') !== 0) {
            var subLevels = line[1].split(", ");
            subLevels.forEach(function (subLevel) {
                var optimizedLine = line.slice();
                optimizedLine[1] = line[0] != line[1] ? subLevel : '';
                convertOptimizedLine(optimizedLine);
            });
        }
    };

    var convertOptimizedLine = function (line) {
        trimAll(line);
        fillZones(line);
    };

    csv().from(filename).to.array(function (data) {
        delete data[0];
        data.forEach(convertLine);
        finalCallback();
    });
};

var isRange = function (value) {
    return value.toString().indexOf('-') > -1;
};

var getRange = function (value) {
    var indexOfHyphen = value.indexOf('-');
    var min = parseInt(value.substr(0, indexOfHyphen), 10);
    var max = parseInt(value.substr(indexOfHyphen + 1), 10);
    return [min, max];
};

var getMeanValue = function (value) {
    if (!value || !isRange(value)) {
        return value;
    }
    var minMax = getRange(value);
    return minMax[0] + ((minMax[1] - minMax[0]) / 2);
};

var fillAverages = function () {
    ["natrium", "kalium", "calcium", "magnesium", "mangan", "ammonium", "nitrat", "sulfat", "chlorid", "fluorid", "hardness"].forEach(function (attribute) {
        var sum = 0;
        Object.keys(zones).forEach(function (zoneId) {
            var value = getMeanValue(zones[zoneId][attribute]);
            if (value) {
                sum += value;
            }
        });
        averageValues[attribute] = Math.round(sum / Object.keys(zones).length * 10) / 10;
    });
};

var stringComparator = function (a, b) {
    a = a.toLowerCase();
    a = a.replace(/ä/g, "a");
    a = a.replace(/ö/g, "o");
    a = a.replace(/ü/g, "u");
    a = a.replace(/ß/g, "s");

    b = b.toLowerCase();
    b = b.replace(/ä/g, "a");
    b = b.replace(/ö/g, "o");
    b = b.replace(/ü/g, "u");
    b = b.replace(/ß/g, "s");

    return (a == b) ? 0 : (a > b) ? 1 : -1;
};

var sortLocations = function () {
    var sortedLocations = {};
    var locationNames = Object.keys(locations);
    locationNames.sort(stringComparator);
    locationNames.forEach(function (locationName) {
        sortedLocations[locationName] = locations[locationName];
    });
    locations = sortedLocations;
};

var writeCallback = function() {
    // do nothing!
}

var writeLocationFile = function () {
    var stringifyResult = JSON.stringify(locations, null, '\t');
    fs.writeFile('../src/data/locations-vgnastaetten.js', 'tw.data.locations = ' + stringifyResult + ';', 'utf-8', writeCallback);
};
var writeZonesFile = function () {
    var stringifyResult = JSON.stringify(zones, null, '\t');
    var averageValuesStringifyResult = JSON.stringify(averageValues, null, '\t');
    fs.writeFile('../src/data/zones-vgnastaetten.js', 'tw.data.zones = ' + stringifyResult + '; tw.data.averageValues = ' + averageValuesStringifyResult + ';', 'utf-8', writeCallback);
};

async.eachLimit(['2018_Wasseruntersuchung_VG-Nastaetten.csv'], 1, convertCsv, function (err) {
    if (err) {
        console.log(err);
        process.exit(1);
    }

    fillAverages();
    sortLocations();
    writeLocationFile();
    writeZonesFile();
});
