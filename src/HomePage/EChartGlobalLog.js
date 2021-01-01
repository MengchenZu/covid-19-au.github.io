import React, { Component } from 'react';
import globalConfirmed from '../data/time_series_covid19_confirmed_global.csv';
import ReactEchartsCore from 'echarts-for-react/lib/core';
import echarts from 'echarts/lib/echarts';
import 'echarts/lib/chart/line';
import 'echarts/lib/component/title';

import ButtonGroup from '@material-ui/core/ButtonGroup';
import Button from '@material-ui/core/Button';
// import i18n bundle
import i18next from '../i18n';
import ReactGA from "react-ga";
import cm from "../ColorManagement/ColorManagement";


class EChartglobalLog extends Component {
    static defaultProps = {
        countryColours: {
            AU: {
                backgroundColor: '#00843D'
            },
            Canada: {
                backgroundColor: '#ff8f75'
            },
            China: {
                backgroundColor: '#eb3423'
            },
            Denmark: {
                backgroundColor: '#8e9191'
            },
            France: {
                backgroundColor: '#ed7d51'
            },
            Germany: {
                backgroundColor: '#f9d649'
            },
            India: {
                backgroundColor: '#f19d49'
            },
            Iran: {
                backgroundColor: '#79d9b4'
            },
            Italy: {
                backgroundColor: '#79aaf2'
            },
            Japan: {
                backgroundColor: '#ff91a9'
            },
            NZ: {
                backgroundColor: '#363636'
            },
            'South Korea': {
                backgroundColor: '#8ccfff'
            },
            Norway: {
                backgroundColor: '#855a8f'
            },
            Singapore: {
                backgroundColor: '#8fc4c4'
            },
            Spain: {
                backgroundColor: '#9fa4fc'
            },
            Sweden: {
                backgroundColor: '#8a9fd4'
            },
            Switzerland: {
                backgroundColor: '#c79e8f'
            },
            UK: {
                backgroundColor: '#bf2a2c'
            },
            US: {
                backgroundColor: '#4d538a'
            }
        },
        activeStyles: {
            color: 'black',
            borderColor: '#8ccfff',
            padding: "0px",
            outline: "none",
            zIndex: 10
        },
        inactiveStyles: {
            color: 'grey',
            borderColor: '#e3f3ff',
            padding: "0px",
            outline: "none"
        }
    }
    constructor(props) {
        super(props);
        this.chartReference = React.createRef();
        this.state = {
            xlabels: [],
            arrMap: {},
            dates: [],
            dataSets: [],
            logScale: true,
            selected: {
                'AU': true,
                'China': true,
                'Italy': true,
                'Japan': true,
                'UK': true,
                'US': true,
                'Singapore': false,
                'Canada': false,
                'Norway': false,
                'France': false,
                'Switzerland': false,
                'Sweden': false,
                'Denmark': false,
                'Iran': false,
                'Spain': false,
                'Germany': false,
                'South Korea': false,
                'India': false
            }
        }
    }

    // merge x and y into the same object.
    mergeXY = (xVals, yVals) => {
        let mergedXY = []
        for (let i = 0; i < xVals.length; i++) {
            mergedXY.push([xVals[i], yVals[i]]);
        }
        return mergedXY;
    }

    // The sum of new cases in the last week.
    calcWeeklyNewCases = (totalCases) => {
        let weeklySum = totalCases.slice(0, 7);
        for (let i = 7; i < totalCases.length; i++) {
            weeklySum.push(totalCases[i] - totalCases[i - 7]);
        }
        return weeklySum;
    }

    // Calculate the difference in days between today and the inputted date.
    daysSince = (xDateLabels) => {
        // Milliseconds in 1 day.
        const one_day = 24 * 60 * 60 * 1000;
        const xlabelsFunc = [];
        xDateLabels.forEach(label => {
            const splitDates = label.split('/');
            const month = splitDates[0];
            const day = splitDates[1];
            //const year = splitDates[2];
            label = Math.round(Math.abs((new Date(2020, month - 1, day) - new Date()) / one_day));
            xlabelsFunc.push(label);
        })
        this.setState({ xlabels: xlabelsFunc });
    }

    // Merge two columns of ints
    mergeColumns = (column1, column2) => {
        return column1.map(function (v, i) { return v + this[i]; }, column2);
    }

    // Turn array of strings to numbers.
    parseArray = (column1) => {
        return column1.map(function (v, i) { return parseInt(v) });
    }

    // Filter the countries to the ones we want
    filterCountries = (country) => {
        const viableCountries = ["\"Korea", "Australia", "Italy", "Iran", "Spain", "US", "Switzerland", "France", "Germany", "United Kingdom", "Hong Kong", "Canada", "China", "Norway", "Denmark", "Sweden", "Singapore", "Japan", "New Zealand", "India"];
        if (viableCountries.includes(country)) {
            return true;
        }
        return false;
    }

    formatDates = (dates) => {
        return (dates.map(date => {
            const dateParts = date.split('/');
            return dateParts[1] + '/' + dateParts[0] + '/' + dateParts[2];
        }))
    }

    getData = async () => {
        // Get Response
        const response = await fetch(globalConfirmed);
        const data = await response.text();

        // Get x-axis Labels
        let dates = data.trim().split('\n').slice(0, 1)[0].split(',').slice(4)
        this.setState({ dates: this.formatDates(dates) });

        this.daysSince(dates);

        // parse table
        const table = data.trim().split('\n').slice(1);
        table.forEach(row => {
            // Filter for relevant countries
            const country = row.split(',').slice(1, 2);
            if (this.filterCountries(country[0])) {

                // Parse out columns we don't want from row
                let parsedRow = row.split(',').slice(1, 2).concat(row.split(',').slice(4));

                if (parsedRow[0] === "\"Korea") {
                    parsedRow = row.split(',').slice(1, 2).concat(row.split(',').slice(5));
                    parsedRow[0] = "South Korea";
                }
                if (parsedRow[0] === "United Kingdom") {
                    parsedRow = row.split(',').slice(1, 2).concat(row.split(',').slice(5));
                    parsedRow[0] = "UK";
                }
                if (parsedRow[0] === "Australia") {
                    parsedRow = row.split(',').slice(1, 2).concat(row.split(',').slice(5));
                    parsedRow[0] = "AU";
                }
                if (parsedRow[0] === "New Zealand") {
                    parsedRow = row.split(',').slice(1, 2).concat(row.split(',').slice(5));
                    parsedRow[0] = "NZ";
                }
                // If the hashmap doesn't have the key, then insert, otherwise add the values.
                if (!this.state.arrMap[parsedRow[0]]) {
                    this.state.arrMap[parsedRow[0]] = {};
                    this.state.arrMap[parsedRow[0]]["x"] = this.parseArray(parsedRow.slice(1));
                    this.state.arrMap[parsedRow[0]]["dates"] = dates;
                } else {
                    this.state.arrMap[parsedRow[0]]["x"] = this.mergeColumns(this.parseArray(this.state.arrMap[parsedRow[0]]["x"]), this.parseArray(parsedRow.slice(1)));
                }
            }

        })
    }

    chartIt = async () => {
        await this.getData();
        // const ctx = document.getElementById('chart').getContext('2d');
        let arrMapKeys = Object.keys(this.state.arrMap);

        arrMapKeys.forEach(key => {
            let i = 0;
            for (i; i < this.state.arrMap[key]["x"].length; i++) {
                if (this.state.arrMap[key]["x"][i] >= 100) {
                    break;
                }
            }
            this.state.arrMap[key]["dates"] = this.state.arrMap[key]["dates"].slice(i);
            this.state.arrMap[key]["x"] = this.state.arrMap[key]["x"].slice(i);
            let updatedCases = this.calcWeeklyNewCases(this.state.arrMap[key]["x"]).map((cases) => {
                if (cases === 0) {
                    return 1;
                }
                return cases;
            })
            this.state.arrMap[key]["y"] = updatedCases;
            this.state.arrMap[key]["x,y"] = this.mergeXY(this.state.arrMap[key]["x"], this.state.arrMap[key]["y"]);
        })


        const dataSets = [];
        for (let i = 0; i < arrMapKeys.length; i++) {
            let newDataSet = {};
            newDataSet["name"] = i18next.t("homePage:country." + arrMapKeys[i]);
            newDataSet["z"] = arrMapKeys[i] === "AU" ? 3 : arrMapKeys[i] === "US" ? 1 : 2;
            newDataSet["type"] = "line";
            newDataSet["smooth"] = true;
            newDataSet["symbol"] = "diamond";
            newDataSet["sampling"] = "average";
            newDataSet["itemStyle"] = {
                color: this.props.countryColours[arrMapKeys[i]].backgroundColor
            };
            newDataSet["data"] = this.state.arrMap[arrMapKeys[i]]["x,y"].map((val, index) => {
                if (this.state.arrMap[arrMapKeys[i]]["x,y"].length - 1 === index) {
                    return {
                        name: this.state.dates[(this.state.dates.length - 1) - (this.state.arrMap[arrMapKeys[i]]["x,y"].length - 1) + index],
                        value: val,
                        symbolSize: 8,
                        label: {
                            show: true,
                            formatter: '{a}'
                        }
                    };
                } else {
                    return {
                        name: this.state.dates[(this.state.dates.length - 1) - (this.state.arrMap[arrMapKeys[i]]["x,y"].length - 1) + index],
                        value: val,
                        symbolSize: 1
                    };
                }
            });

            dataSets.push(newDataSet);
        }
        this.setState({ dataSets: dataSets });

    }
    changeAllState(state) {
        let arrMapKeys = Object.keys(this.state.arrMap);
        let selectAll = {}
        for (let i = 0; i < arrMapKeys.length; i++) {
            selectAll[i18next.t("homePage:country." + arrMapKeys[i])] = state;
        };
        this.setState({ selected: selectAll });
    }
    onSelectAllClick = () => {

        this.changeAllState(true);
    }

    onDeselectAllClick = () => {
        this.changeAllState(false);
    }

    componentDidMount() {
        this.chartIt();
        let echarts_instance = this.chartReference.getEchartsInstance();
        echarts_instance.on('legendselectchanged', function (props) {
            ReactGA.initialize("UA-160673543-1");
            ReactGA.event({ category: 'globalChart', action: props.name, label: props.selected[props.name] ? 'true' : 'false' })

        });
    }


    render() {
        return (
            <div className="card">
                <h2>{i18next.t("homePage:globalChart.title")}</h2>
                <ButtonGroup style={{ justifyContent: "center" }} size="small" aria-label="small outlined button group">
                    <Button style={{
                        textTransform: 'none',
                        paddingTop: '0.1rem',
                        paddingBottom: '0.1rem',
                        outline: "none"
                    }} disableElevation={true} onClick={this.onSelectAllClick}>{i18next.t("homePage:globalChart.selectAll")}</Button>
                    <Button style={{
                        textTransform: 'none',
                        paddingTop: '0.1rem',
                        paddingBottom: '0.1rem',
                        outline: "none"
                    }} onClick={this.onDeselectAllClick}>{i18next.t("homePage:globalChart.selectNo")}</Button>
                </ButtonGroup>
                <ReactEchartsCore
                    echarts={echarts}
                    style={{ minHeight: "500px" }}
                    ref={(e) => { this.chartReference = e; }}
                    lazyUpdate={true}
                    option={{
                        legend: {
                            show: true,
                            left: "center",
                            top: "top",
                            itemGap: 5,
                            selected: this.state.selected
                        },
                        grid: {
                            containLabel: true,
                            left: 0,
                            right: "10%",
                            bottom: "10%",

                            top: window.innerWidth > 500 ? "15%" : "26%"
                        },
                        tooltip: {
                            trigger: 'axis',
                            backgroundColor: "white",
                            borderColor: "#bae1ff",
                            borderWidth: "1",
                            textStyle: {
                                color: "black"
                            },
                            formatter: function (params, ticket, callback) {
                                return params[0].seriesName + "<br /> Date: " + params[0].name + "<br /> Total: " + params[0].value[0].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "<br /> Weekly: " + params[0].value[1].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                            }
                        },
                        toolbox: {
                            show: false
                        },
                        series: this.state.dataSets,
                        axisPointer: {
                            type: 'cross',
                        },
                        yAxis: {
                            name: i18next.t("homePage:status.newCaseWeek"),
                            nameTextStyle: {
                                align: 'left'
                            },
                            type: this.state.logScale ? "log" : "value",
                            boundaryGap: true,
                            axisLabel: {
                                show: true
                            },
                            scale: true
                        },
                        xAxis: {
                            name: i18next.t("homePage:status.total"),
                            nameTextStyle: {
                                align: 'center'
                            },
                            type: this.state.logScale ? "log" : "value",
                            boundaryGap: true,
                            scale: true,
                            axisLabel: {
                                showMaxLabel: true
                            }
                        },
                        dataZoom: [{
                            type: 'inside',
                            start: 0,
                            end: 100
                        }, {
                            start: 0,
                            end: 10,
                            handleIcon: 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
                            handleSize: '80%',
                            handleStyle: {
                                color: '#fff',
                                shadowBlur: 3,
                                shadowColor: 'rgba(0, 0, 0, 0.6)',
                                shadowOffsetX: 2,
                                shadowOffsetY: 2
                            },
                            bottom: "0%",
                            left: "center"
                        }],
                    }}
                />
                <span className="due">
                    <span className="key" style={{ fontSize: "80%", paddingTop: 0 }}>
                        {i18next.t("homePage:globalChart.updateNotice")}{this.state.dates[this.state.dates.length - 1]}
                    </span><br /><br />

                    <span className="key" style={{color: "#333"}}>*See also the <a className="citationLink" href={"/world"}>world map page</a>.<p></p></span><br />
                    <span className="key">{i18next.t("homePage:chartCommon.clickLegend")}<p></p></span><br />
                    <span className="key">{i18next.t("homePage:chartCommon.clickPoint")}<p></p></span><br />
                    <span className="key"><p>{i18next.t("homePage:globalChart.append0")}</p></span><br />
                    <span className="key">{i18next.t("homePage:globalChart.append1")}<p> <a className="citationLink" target="_blank" rel="noopener noreferrer" href="https://www.youtube.com/watch?v=54XLXg4fYsc&feature=emb_title">{i18next.t("homePage:globalChart.append2")}</a>{i18next.t("homePage:globalChart.append3")}</p></span><br />
                    <span className="key">{i18next.t("homePage:globalChart.append4")}<p><a target="_blank" rel="noopener noreferrer" href="https://github.com/CSSEGISandData/COVID-19">

                        <svg className="bi bi-question-circle" width="1.1em" height="1.1em" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm0 1A8 8 0 108 0a8 8 0 000 16z" clipRule="evenodd" />
                            <path d="M5.25 6.033h1.32c0-.781.458-1.384 1.36-1.384.685 0 1.313.343 1.313 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.007.463h1.307v-.355c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.326 0-2.786.647-2.754 2.533zm1.562 5.516c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z" />
                        </svg>
                    </a></p></span><br />
                    <span className="key" style={{ marginTop: "0.5rem" }}>

                        {i18next.t("homePage:misc.logScale")}&nbsp;
                    <ButtonGroup size="small" aria-label="small outlined button group">
                            <Button style={cm.getPillButtonColors(!this.state.logScale)} onClick={() => this.setState({ logScale: false })}>{i18next.t("homePage:misc.offButton")}</Button>
                            <Button style={cm.getPillButtonColors(this.state.logScale)} disableElevation={true} onClick={() => this.setState({ logScale: true })}>{i18next.t("homePage:misc.onButton")}</Button>
                        </ButtonGroup>
                        <a
                            style={{
                                display: "inline-flex",
                                backgroundColor: "white",
                                verticalAlign: "middle"
                            }}
                            className="badge badge-light"
                            href="https://en.wikipedia.org/wiki/Logarithmic_scale"
                            target="blank"
                        >
                            <svg className="bi bi-question-circle" width="1.1em" height="1.1em" viewBox="0 0 16 16" fill="currentColor"
                                xmlns="http://www.w3.org/2000/svg">
                                <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm0 1A8 8 0 108 0a8 8 0 000 16z"
                                    clipRule="evenodd" />
                                <path
                                    d="M5.25 6.033h1.32c0-.781.458-1.384 1.36-1.384.685 0 1.313.343 1.313 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.007.463h1.307v-.355c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.326 0-2.786.647-2.754 2.533zm1.562 5.516c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z" />
                            </svg>
                            <div className="dataSource"></div>
                        </a>

                    </span>
                </span>

            </div>
        )
    }
}

export default EChartglobalLog;