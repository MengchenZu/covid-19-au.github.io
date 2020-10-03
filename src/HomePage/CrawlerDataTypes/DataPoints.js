/**
This file is licensed under the MIT license

Copyright (c) 2020 David Morrissey

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */

import CasesData from "../CrawlerData/CasesData"
import RegionType from "../CrawlerDataTypes/RegionType"
import UnderlayData from "../CrawlerData/UnderlayData"
import DataPoint from "./DataPoint";
import DateRangeType from "./DateRangeType";


class DataPoints extends Array {
    /**
     * An array of TimeSeriesItem instances. Inherits from Array,
     * so has all the normal methods like push() etc, but also
     * associates a data source, region schema/parent/child,
     * the time period the data is over and optionally an age range
     *
     * @param dataSource a CasesData or UnderlayData instance
     * @param regionType a RegionType instance
     * @param ageRange (optional) the age range the time series value
     *        is relevant for, e.g. "0-9"
     * @param items (optional) populate with these initial items
     */
    constructor(dataSource, regionType, ageRange, items) {
        super();
        if (items) {
            for (var item of items) {
                this.push(item);
            }
        }

        if (
            !(dataSource instanceof CasesData) &&
            !(dataSource instanceof UnderlayData)
        ) {
            throw (
                `RegionType ${regionType} should be an instance of ` +
                `DataSourceBase like CasesData or UnderlayData!`
            );
        }

        if (!(regionType instanceof RegionType)) {
            throw `RegionType ${regionType} should be an instance of RegionType!`;
        }

        this.dataSource = dataSource;
        this.regionType = regionType;
        this.ageRange = ageRange;
    }

    /**
     *
     */
    updateDateRangeType() {
        // TODO!!!
    }

    /********************************************************************
     * Copy/clone array
     ********************************************************************/

    /**
     * Return a new copy of these DataPoints
     *
     * @returns {DataPoints}
     */
    clone() {
        return new DataPoints(this.dataSource, this.regionType, this.ageRange, this);
    }

    /**
     * Clone without any datapoints
     *
     * @returns {DataPoints}
     */
    cloneWithoutDatapoints(items) {
        return new DataPoints(this.dataSource, this.regionType, this.ageRange, items||[]);
    }

    /********************************************************************
     * Sort array
     ********************************************************************/

    /**
     * Sort so that oldest datapoints come last.
     * Sorts in-place (returns `this`)
     *
     * @returns {DataPoints}
     */
    sortAscending() {
        this.sort((a, b) => {return a[0] - b[0]});
        return this;
    }

    /**
     * Sort so that newest datapoints come first.
     * Sorts in-place (returns `this`)
     *
     * @returns {DataPoints}
     */
    sortDescending() {
        this.sort((a, b) => {return b[0] - a[0]});
        return this;
    }

    /********************************************************************
     * Get information about the data source etc
     ********************************************************************/

    /**
     * Get the CasesData or UnderlayData associated with this instance
     *
     * @returns {*}
     */
    getDataSource() {
        return this.dataSource;
    }

    /**
     * Get the RegionType instance associated with these items,
     * allowing getting information about the region schema,
     * region parent, region child.
     *
     * Also allows for limited localization of place names.
     *
     * @returns {*}
     */
    getRegionType() {
        return this.regionType;
    }

    /**
     * Get the age range (e.g. "0-9") which is associated with this
     * set of items. `null` if  there is no such association
     *
     * @returns {*}
     */
    getAgeRange() {
        return this.ageRange;
    }

    /**
     * Get the datatype as a string, e.g. "total" or "status_active"
     *
     * @returns {*}
     */
    getDataType() {
        return this.dataSource.getDataType();
    }

    /**
     * Get the from/to date range of all values as a DateRangeType
     *
     * @returns {DateRangeType}
     */
    getDateRangeType() {
        let minDate = null,
            maxDate = null;

        for (let dataPoint of this) {
            if (!minDate || dataPoint.getDateType() < minDate) {
                minDate = dataPoint.getDateType();
            }
            if (!maxDate || dataPoint.getDateType() > maxDate) {
                maxDate = dataPoint.getDateType();
            }
        }

        return (minDate && maxDate) ?
            new DateRangeType(minDate, maxDate) : null;
    }

    /********************************************************************
     * Get days since value change
     ********************************************************************/

    /**
     * Get the number of days before today that
     * the value was higher than the most recent value.
     */
    getDaysSinceLastIncrease() {
        var firstValue = null;
        for (var [dateType, valueType] of this) {
            if (firstValue == null) {
                firstValue = valueType;
            }
            else {
                if (valueType > firstValue) {
                    return dateType.numDaysSince();
                }
            }
        }
    }

    /**
     * Get the number of days before today that
     * the value was lower than the most recent value.
     */
    getDaysSinceLastDecrease() {
        var firstValue = null;
        for (var [dateType, valueType] of this) {
            if (firstValue == null) {
                firstValue = valueType;
            }
            else {
                if (valueType < firstValue) {
                    return dateType.numDaysSince();
                }
            }
        }
    }

    /********************************************************************
     * Get derived values
     ********************************************************************/

    /**
     * Assuming these values are totals, add samples subtracting from the previous sample.
     *
     * Note this is different to "new" or other "*_new" datatypes, which only adds new
     * values when there are 2 consecutive days of samples. This therefore is suitable
     * for day averages, but not other purposes.
     */
    getNewValuesFromTotals() {
        let r = [];
        let originalArray = this.clone();
        originalArray.sortAscending();

        for (let i=0; i<originalArray.length-1; i++) {
            let timeSeriesItem = originalArray[i],
                prevTimeSeriesItem = originalArray[i+1];

            r.push(new DataPoint(timeSeriesItem.getDateType(), prevTimeSeriesItem.getValue()-timeSeriesItem.getValue(), timeSeriesItem.getSourceId()));
        }

        return new DataPoints(
            this.dataSource, this.regionType, this.ageRange, r
        ).sortDescending();
    }

    /**
     * Get the rolling average over a provided number of days
     *
     * @param overNumDays the number of days to average over
     */
    getDayAverage(overNumDays) {
        // TODO: MAKE THIS OVER *DAYS* NOT *SAMPLES*!!! ==========================================

        // Make sure newest elements are first
        let originalArray = this.clone();
        originalArray.sortDescending();

        let r = [];
        for (let i=0; i<originalArray.length-overNumDays; i++) {
            let totalVal = 0,
                numVals = 0,
                highestDate = originalArray[i].getDateType();

            for (let j=i; j<i+overNumDays; j++) {
                totalVal += originalArray[j] ? originalArray[j].getValue() : 0;
                numVals++;
            }

            r.push(new DataPoint(highestDate, Math.round(totalVal/numVals), originalArray[i].getSourceId())); // NOTE ME!!!! ==================
        }

        return new DataPoints(
            this.dataSource, this.regionType, this.ageRange, r
        );
    }

    /**
     * Create a new DataPoints instance
     *
     * @param dateRangeType
     * @param defaultValue
     * @returns {DataPoints}
     */
    missingDaysFilledIn(dateRangeType, defaultValue, defaultSourceId) {
        let out = new DataPoints(this.dataSource, this.regionType, this.ageRange, []);

        let map = {};
        for (let [dateType, value, sourceId] of this) {
            map[dateType.prettified()] = value;
        }

        // Make sure every date has a datapoint
        // (otherwise eCharts rendering goes haywire)
        let curValue = defaultValue||0,
            sourceId = defaultSourceId||this[0].getSourceId();

        for (let dateType of dateRangeType.toArrayOfDateTypes()) {
            if (dateType.prettified() in map) { // WARNING!!!
                curValue = map[dateType.prettified()];
            }
            out.push(new DataPoint(dateType, curValue, sourceId))
        }

        // Sort by newest first
        out.sortDescending();
        return out;
    }

    /**
     * Create a new DataPoints instance
     *
     * @param dateRangeType
     * @param defaultValue
     * @returns {DataPoints}
     */
    missingDaysInterpolated(dateRangeType, defaultValue) {
        let out = new DataPoints(this.dataSource, this.regionType, this.ageRange, []);

        for (let i=0; i<this.length-1; i++) {
            let [prevDateType, prevValue, prevSourceId] = this[i],
                [nextDateType, nextValue, nextSourceId] = this[i+1],
                numDays = nextDateType.numDaysSince(prevDateType);

            //console.log(`${prevDateType.prettified()} ${nextDateType.prettified()} ${prevValue} ${nextValue}`);

            if (nextDateType > prevDateType) {
                throw "DataPoints should be in descending order for missingDaysInterpolated!"
            }

            for (let j=0; j<numDays; j++) {
                let dateType = prevDateType.daysSubtracted(j),
                    elapsedPc = j / numDays,
                    value = Math.round(
                        (prevValue * (1.0-elapsedPc)) +
                        (nextValue * elapsedPc)
                    );
                out.push(new DataPoint(dateType, value, nextSourceId))
            }
        }

        if (this.length) {
            // Make sure the very last item isn't skipped!
            out.push(this[this.length - 1]);
        }

        // Sort by newest first
        out.sortDescending();
        return out//.missingDaysFilledIn(dateRangeType, defaultValue);
    }

    /**
     *
     * @param overNumDays
     */
    getRateOfChange(overNumDays) {
        // WARNING: This assumes this is in descending order!!!
        // ALSO NOTE: If the number is undefined due to no
        // data for the specified days, "null" will be output!

        let r = [];
        for (let i=0; i<this.length-overNumDays; i++) {
            let [date1, x1, sourceId1] = this[i],
                [date2, x2, sourceId2] = this[i+overNumDays];

            if (date2 > date1) {
                throw "DataPoints should be in descending order for getRateOfChange!"
            }

            let divBy = Math.abs(x1);
            r.push(new DataPoint(
                date1,
                divBy ? (x1 - x2) / divBy : null,
                sourceId1
            ));
        }
        return this.cloneWithoutDatapoints(r);
    }

    /**
     *
     */
    getRatePerCapita100k() {
        // TODO!
    }

    /**
     *
     */
    getRatePerRegion100k() {
        // TODO!
    }
}

export default DataPoints;
