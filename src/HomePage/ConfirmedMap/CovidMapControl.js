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

import React from "react";
import ReactDOM from "react-dom";
import mapboxgl from "mapbox-gl/dist/mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import CovidMapControls from "./MapControls/CovidMapControls";
import MapTimeSlider from "./MapControls/MapTimeSlider";
import getDataDownloader from "../CrawlerData/DataDownloader";
import LngLatBounds from "../CrawlerDataTypes/LngLatBounds";

import DaysSinceLayer from "./Layers/cases/case_layer/DaysSinceLayer";
import CasesFillPolyLayer from "./Layers/cases/case_layer/CasesFillPolyLayer";
import UnderlayFillPolyLayer from "./Layers/underlay/UnderlayFillPolyLayer";
import CaseNumbersLayer from "./Layers/cases/case_layer/CaseNumbersLayer";
import LinePolyLayer from "./Layers/LinePolyLayer";

import MapBoxSource from "./Sources/MapBoxSource";
import ClusteredCaseSource from "./Sources/ClusteredCaseSource";
import DateRangeType from "../CrawlerDataTypes/DateRangeType";
import DateType from "../CrawlerDataTypes/DateType";
import getRemoteData from "../CrawlerData/RemoteData";
import confirmedData from "../../data/mapdataCon";
import MarkerConfirmed from "./Markers/MarkerConfirmed";
import LoadingIndicator from "./MapControls/LoadingIndicator";
import AxiosAnalytics from "./AxiosAnalytics";
import HoverStateHelper from "./Layers/HoverStateHelper";
import BRIGHT_V9_MOD_STYLE from "./bright_v9_mod";
import i18next from "../../i18n";
import NumbersCaseLayer from "./Layers/cases/NumbersCaseLayer";
import RateOfChangeCaseLayer from "./Layers/cases/RateOfChangeCaseLayer";

//Fetch Token from env
let token = process.env.REACT_APP_MAP_API;
mapboxgl.accessToken = token;

const ENABLE_AXIOS_ANALYTICS = false;

// A "blank" style to allow for using vector data
// without downloading from MapBox servers
// TODO: Also don't download glyphs from mapbox?
let style = {
  version: 8,
  name: "Empty",
  metadata: {
    "mapbox:autocomposite": true,
    "mapbox:type": "template",
  },
  glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "rgba(0,0,0,0)",
      },
    },
  ],
};

class CovidMapControl extends React.Component {
  /**
   *
   * @param props
   */
  constructor(props) {
    super(props);
  }

  /*******************************************************************
   * HTML Template
   *******************************************************************/

  render() {
    return (
      <div
        ref={(el) => (this.absContainer = el)}
        style={{ position: "relative" }}
      >
        <div
          ref={(el) => (this.mapContainer = el)}
          style={{
            background: "white",
            height: this.props.height || "60vh",
          }}
        ></div>

        <LoadingIndicator ref={(el) => (this.loadingIndicator = el)} />

        <MapTimeSlider
          ref={(el) => {
            this.__mapTimeSlider = el;
          }}
          onChange={(newValue) => this._onMapTimeSlider(newValue)}
          numDays={90}
        />
      </div>
    );
  }

  /*******************************************************************
   * Intialization after load
   *******************************************************************/

  componentDidMount() {
    this.__unmounted = false;

    const map = (this.map = new mapboxgl.Map({
      container: this.mapContainer,
      //style: style,
      //style: 'mapbox://styles/mapbox/light-v10?optimize=true',
      //style: 'mapbox://styles/mapbox/streets-v11?optimize=true',
      //style: 'mapbox://styles/mapbox/satellite-v9?optimize=true',
      //style: 'mapbox://styles/mapbox/bright-v9?optimize=true',
      style: BRIGHT_V9_MOD_STYLE,
      zoom: 1,
      maxZoom: 15.5,

      pitch: 0,

      //minZoom: 1,
      transition: {
        duration: 0,
        delay: 0,
      },
      fadeDuration: 0,
    }));

    let runMeLater = async () => {
      //console.log("Getting remote data...");
      this.remoteData = await getRemoteData();
      //console.log("Remote data fetched");
      this.dataDownloader = await getDataDownloader(this.remoteData);
      this.dataDownloader.setLoadingIndicator(this.loadingIndicator);

      // Preload some more common data
      this.dataDownloader.getCaseData("total", "admin_0", "");
      this.dataDownloader.getCaseData("total", "admin_1", "au");
      this.dataDownloader.getCaseData("total", "lga", "vic");
      this.dataDownloader.getCaseData("total", "lga", "nsw");
      this.dataDownloader.getGeoData("admin_0", "");
      this.dataDownloader.getGeoData("admin_1", "au");
      this.dataDownloader.getGeoData("lga", "vic");
      this.dataDownloader.getGeoData("lga", "nsw");

      if (!this.mapContainer) {
        // Control probably destroyed in the interim!
        return;
      }

      // Add the map controls to the map container element so that
      // they'll be displayed when the map is shown fullscreen
      let mapContainerChild = document.createElement("div");
      this.mapContainer.appendChild(mapContainerChild);
      ReactDOM.render(
        <CovidMapControls
          ref={(el) => (this.covidMapControls = el)}
          onchange={(e) => this._onControlsChange(e)}
          dataType={this.props.dataType}
          timePeriod={this.props.timePeriod}
        />,
        mapContainerChild
      );

      // Disable map rotation
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();

      // Add geolocate control to the map.
      map.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true,
          },
          trackUserLocation: true,
        })
      );

      //Add zoom+fullscreen controls
      map.addControl(new mapboxgl.NavigationControl());
      map.addControl(new mapboxgl.FullscreenControl());

      let onLoad = () => {
        if (this.__unmounted) {
          //console.log("UNMOUNTED!!!")
          return;
        } else if (!map.loaded()) {
          // Sometimes the load event doesn't fire here due to
          // it being in an async function, so just keep polling!
          return setTimeout(onLoad, 20);
        }

        // Insert the layer beneath any symbol layer.
        var layers = map.getStyle().layers;

        var labelLayerId;
        for (var i = 0; i < layers.length; i++) {
          if (layers[i].type === "symbol" && layers[i].layout["text-field"]) {
            labelLayerId = layers[i].id;
            break;
          }
        }

        map.addLayer(
          {
            id: "3d-buildings",
            source: "mapbox",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": "#aaa",

              // use an 'interpolate' expression to add a smooth transition effect to the
              // buildings as the user zooms in
              "fill-extrusion-height": [
                "interpolate",
                ["linear"],
                ["zoom"],
                14,
                0,
                15.05,
                ["*", ["get", "height"], 3],
              ],
              "fill-extrusion-base": [
                "interpolate",
                ["linear"],
                ["zoom"],
                14,
                0,
                15.05,
                ["*", ["get", "min_height"], 3],
              ],
              "fill-extrusion-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                14.5,
                0.0,
                15.5,
                0.6,
              ],
            },
          },
          labelLayerId
        );

        let localeMap = {
          tw: "zh", // HACK - need to update to streets-v8 to have proper zh-Hant!
          zh: "zh-Hans",
        };

        map.setPaintProperty("water", "fill-color", "#9fc4e1");
        for (let id of [
          "country_label_1",
          "country_label_2",
          "country_label_3",
          "country_label_4",
          "marine_label_point_1",
          "marine_label_line_1",
          "marine_label_point_2",
          "marine_label_line_2",
          "marine_label_point_3",
          "marine_label_line_3",
          //'marine_label_point_4', 'marine_label_line_4',
          "place_label_city",
          "place_label_town",
          "place_label_village",
          "place_label_other",
          "road_label",
          "airport_label",
          "poi_label_1",
          "rail_station_label",
          "poi_label_2",
          "poi_label_3",
          "poi_label_4",
          "water_label",
          "road_major_label",
          "poi_label",
        ]) {
          map.setLayoutProperty(id, "text-field", [
            "get",
            "name_" + localeMap[i18next.language] || i18next.language,
          ]);
        }

        const CASES_LINE_POLY_COLOR = "rgba(202, 210, 211, 1.0)";
        const UNDERLAY_LINE_POLY_COLOR = "rgba(0,0,0,0.3)";

        // Create the MapBox sources
        let underlaySource = (this.underlaySource = new MapBoxSource(map));
        let casesSource = (this.casesSource = new MapBoxSource(map));
        let clusteredCaseSource = (this.clusteredCaseSource = new ClusteredCaseSource(
          this.remoteData,
          map,
          null,
          null,
          null,
          (feature) => {
            if (this.covidMapControls.getDisplayGraphs()) {
              let r =
                feature.properties.casesTimeSeries &&
                feature.properties.casesTimeSeries.length;
              /*if (r) {
                            for (let val of feature.properties.casesTimeSeries) {
                                if (val != null) {
                                    feature.properties.cases = val; // HACK!
                                    break;
                                }
                            }
                        }*/
              return r;
            } else {
              return feature.properties.cases;
            }
          }
        ));

        // Add layers for the underlay
        this.underlayFillPoly = new UnderlayFillPolyLayer(
          map,
          "underlayFillPoly",
          underlaySource
        );
        this.underlayLinePoly = new LinePolyLayer(
          map,
          "underlayLinePoly",
          UNDERLAY_LINE_POLY_COLOR,
          1.0,
          underlaySource
        );

        // Add layers for cases
        this.hoverStateHelper = new HoverStateHelper(map);
        this.casesFillPolyLayer = new CasesFillPolyLayer(
          map,
          "casesFillPolyLayer",
          casesSource,
          this.hoverStateHelper
        );
        //this.casesLinePolyLayer = new LinePolyLayer(map, 'casesLinePolyLayer', CASES_LINE_POLY_COLOR, null, casesSource);
        this.daysSinceLayer = new DaysSinceLayer(
          map,
          "daysSinceLayer",
          casesSource
        );
        this.numbersCaseLayer = new NumbersCaseLayer(
          this.remoteData,
          map,
          "nums",
          clusteredCaseSource,
          this.hoverStateHelper
        );
        this.rateOfChangeCaseLayer = new RateOfChangeCaseLayer(
          this.remoteData,
          map,
          "roc",
          clusteredCaseSource,
          this.hoverStateHelper
        );

        // Bind events for loading data
        //map.on('move', () => {
        //    this.onMapMoveChange();
        //});
        //map.on('zoom', () => {
        //    this.onMapMoveChange();
        //});
        map.on("moveend", () => {
          this.onMapMoveChange();
        });
        map.on("zoomstart", () => {
          this.__resetPointsData();
        });
        map.on("zoomend", () => {
          this.onMapMoveChange();
        });

        // Add markers: confirmed cases/hospitals
        // only for tas/nt at this point
        this.confirmedMarkers = [];
        confirmedData.forEach((item) => {
          this.confirmedMarkers.push(new MarkerConfirmed(map, item));
        });

        // Init analytics
        if (ENABLE_AXIOS_ANALYTICS) {
          this.axiosAnalytics = new AxiosAnalytics(
            map,
            this.covidMapControls,
            this.__mapTimeSlider
          );
        }

        if (this.props.onload) {
          this.props.onload(this, map);
        }
        this.onMapMoveChange();
      };
      onLoad();
    };
    runMeLater();
  }

  componentWillUnmount() {
    this.__unmounted = true;
  }

  addToMapContainer(elm) {
    this.mapContainer.appendChild(elm);
  }

  /*******************************************************************
   * Time Slider Events
   *******************************************************************/

  /**
   *
   * @private
   */
  _onMapTimeSlider() {
    if (
      !this.__dataCollection ||
      !this.prevDataType ||
      this.prevZoomLevel == null
    ) {
      return;
    }
    this.__onMapTimeSlider();
  }

  /**
   *
   * @private
   */
  __onMapTimeSlider() {
    let poll = () => {
      if (!this.map || !this.__mapTimeSlider) {
        this.__pollingTS = false;
        return;
      } else if (this.map.loaded()) {
        this.__pollingTS = false;

        // Get the date range for the 7/14/21 day controls
        let dateRangeType = null,
          currentDateType = this.__mapTimeSlider.getValue();

        if (this.covidMapControls.getTimePeriod()) {
          dateRangeType = new DateRangeType(
            currentDateType.daysSubtracted(
              this.covidMapControls.getTimePeriod()
            ),
            currentDateType
          );
        }

        this.__onMapMoveChange(
          this.__dataCollection.getAssignedData(dateRangeType, currentDateType),
          this.prevDataType,
          this.prevZoomLevel,
          true
        );
      } else {
        return setTimeout(poll, 0);
      }
    };

    if (this.__pollingTS) {
      return;
    }
    this.__pollingTS = true;
    poll();
  }

  /*******************************************************************
   * MapBox GL Events
   *******************************************************************/

  __pollForMapChange() {
    let poll = () => {
      if (!this.map || !this.__mapTimeSlider) {
        this.__polling = false;
        return;
      } else if (!this.__loadInProgress) {
        this.__polling = false;
        this.onMapMoveChange();
      } else {
        setTimeout(poll, 0);
      }
    };

    if (this.__polling) {
      return;
    }
    this.__polling = true;
    setTimeout(poll, 0);
  }

  /**
   * Download any static/case data based on the
   * countries/regions in view, and hide/show as needed!
   */
  async onMapMoveChange() {
    if (!this.__mapTimeSlider || !this.map) {
      return;
    } else if (this.__loadInProgress) {
      this.__pollForMapChange();
    }
    this.__loadInProgress = true;

    try {
      /**
       *
       * @param possibleSchemas
       * @returns {Set<unknown>|*}
       */
      let filterToISO3166 = (possibleSchemas) => {
        if (!this.__onlyShowISO_3166_2) {
          return possibleSchemas;
        }
        let r = new Set(),
          iso_3166_2 = this.__onlyShowISO_3166_2.toLowerCase(),
          iso_3166_a2 = iso_3166_2.split("-")[0];

        for (let key of possibleSchemas.keys()) {
          if (
            key === iso_3166_2 ||
            key === iso_3166_a2 ||
            key.split("-")[0] === iso_3166_2
          ) {
            r.add(key);
            //console.log("ADDING> "+key)
          }
        }
        return r;
      };

      let zoomLevel = parseInt(this.map.getZoom()), // NOTE ME!!
        lngLatBounds = LngLatBounds.fromMapbox(this.map.getBounds()),
        iso3166WithinView = filterToISO3166(
          this.dataDownloader.getISO3166WithinView(lngLatBounds)
        ),
        dataType = this.covidMapControls.getDataType(),
        schemasForCases = this.dataDownloader.getPossibleSchemasForCases(
          zoomLevel,
          iso3166WithinView,
          dataType
        );

      if (this.prevSchemasForCases) {
        let changed =
          zoomLevel !== this.prevZoomLevel ||
          this.dataDownloader.caseDataForZoomAndCoordsChanged(
            zoomLevel,
            this.prevDataType,
            this.prevSchemasForCases,
            dataType,
            schemasForCases
          );
        if (!changed) {
          return;
        }
      }

      // Get the date range for the 7/14/21 day controls
      let dateRangeType = null,
        currentDateType = this.__mapTimeSlider.getValue();

      if (this.covidMapControls.getTimePeriod()) {
        dateRangeType = new DateRangeType(
          currentDateType.daysSubtracted(this.covidMapControls.getTimePeriod()),
          currentDateType
        );
      }

      // First update without downloading geodata/case data
      let dataCollectionNoDownload = (this.__dataCollection = await this.dataDownloader.getDataCollectionForCoords(
        lngLatBounds,
        dataType,
        schemasForCases,
        iso3166WithinView,
        true
      ));
      this.__onMapMoveChange(
        dataCollectionNoDownload.getAssignedData(
          dateRangeType,
          currentDateType
        ),
        dataType,
        zoomLevel
      );

      // Then download case/geodata if need be
      if (!dataCollectionNoDownload.getMoreToDownload()) {
        let dataCollection = (this.__dataCollection = await this.dataDownloader.getDataCollectionForCoords(
          lngLatBounds,
          dataType,
          schemasForCases,
          iso3166WithinView,
          false
        ));
        if (
          dataCollectionNoDownload.insts.length !== dataCollection.insts.length
        ) {
          this.__onMapMoveChange(
            dataCollection.getAssignedData(dateRangeType, currentDateType),
            dataType,
            zoomLevel
          );
        }
      }
    } finally {
      this.__loadInProgress = false;
    }
  }

  /**
   *
   * @param geoData
   * @param dataType
   * @param zoomLevel
   * @private
   */
  __onMapMoveChange(geoData, dataType, zoomLevel, noUpdateEvent) {
    if (!this.map || !this.__mapTimeSlider) {
      // React JS likely destroyed the elements in the interim
      return;
    } else {
      // Update the sources
      this.clusteredCaseSource.setData(
        dataType,
        geoData.points,
        geoData.geoDataInsts,
        geoData.caseDataInsts
      );
      this.casesSource.setData(
        dataType,
        geoData.polygons,
        geoData.geoDataInsts,
        geoData.caseDataInsts
      );
      this.geoDataInsts = geoData.geoDataInsts;
      this.caseDataInsts = geoData.caseDataInsts;

      // Remember these schemas/datatypes/zoom levels for
      // later, so as to not need to refresh if not changed
      this.prevSchemasForCases = geoData.schemasForCases;
      this.prevDataType = dataType;
      this.prevZoomLevel = zoomLevel;

      // Now add the layers
      this.casesFillPolyLayer.updateLayer();
      //this.casesLinePolyLayer.updateLayer();

      if (!this.covidMapControls.getDisplayGraphs()) {
        this.numbersCaseLayer.updateLayer(
          null,
          this.__mapTimeSlider.getValue()
        );
        this.numbersCaseLayer.fadeIn();
        this.rateOfChangeCaseLayer.fadeOut();
      } else {
        this.rateOfChangeCaseLayer.updateLayer(
          null,
          this.__mapTimeSlider.getValue()
        );
        this.rateOfChangeCaseLayer.fadeIn();
        this.numbersCaseLayer.fadeOut();
      }

      // Make it so click events are registered for analytics (if relevant)
      if (this.axiosAnalytics) {
        this.axiosAnalytics.associateLayerId(
          this.casesFillPolyLayer.getLayerId()
        );
      }

      // Hide/show markers based on datatype
      if (new Set(["total", "status_active"]).has(dataType)) {
        // Show/hide markers depending on whether they are within 3 weeks
        // if in "total" or "active" mode, otherwise leave all hidden
        for (let marker of this.confirmedMarkers) {
          if (marker.getIsActive(this.__mapTimeSlider.getValue())) {
            marker.show();
          } else {
            marker.hide();
          }
        }
      } else {
        for (let marker of this.confirmedMarkers) {
          marker.hide();
        }
      }
    }

    let arraysEqual = (arr1, arr2) => {
      // Check if all items exist and are in the same order
      for (var i = 0; arr1.length < i; i++) {
        if (arr1[i] !== arr2[i]) return false;
      }
    };

    if (!noUpdateEvent && this.props.onGeoDataChanged) {
      // Send an event to allow for "data updated on xx date"
      // etc displays outside the control
      if (
        this.prevGeoData &&
        this.prevGeoData.geoDataInsts.length === geoData.geoDataInsts.length &&
        this.prevGeoData.caseDataInsts.length ===
          geoData.caseDataInsts.length &&
        arraysEqual(this.prevGeoData.geoDataInsts, geoData.geoDataInsts) &&
        arraysEqual(this.prevGeoData.caseDataInsts, geoData.caseDataInsts)
      ) {
        // Don't update if not changed!
      } else {
        this.props.onGeoDataChanged(
          geoData.geoDataInsts,
          geoData.caseDataInsts
        );
      }
    }
    this.prevGeoData = geoData;
  }

  /*******************************************************************
   * Mode update
   *******************************************************************/

  /**
   *
   * Restrict boundaries and case data to a specific
   * ISO 3166-2 code, for example "au-vic"
   *
   * @param iso_3166_2
   */
  setBoundsToRegion(iso_3166_2) {
    let runMe = () => {
      if (!this.map || !this.dataDownloader) {
        return setTimeout(runMe, 50);
      }

      let animOptions = {
        animate: false,
      };

      if (!iso_3166_2) {
        // no boundary: show whole world
        this.map.setMaxBounds([
          [-180, -90],
          [180, 90],
        ]);
        this.map.fitBounds(
          [
            [-180, -90],
            [180, 90],
          ],
          animOptions
        );
        this.__onlyShowISO_3166_2 = iso_3166_2;
      } else {
        // ISO 3166-2
        iso_3166_2 = iso_3166_2.toLowerCase();
        let bounds = this.dataDownloader
          .getAdminBoundsForISO_3166_2(iso_3166_2)
          .enlarged(0.15)
          .toMapBox();
        this.map.setMaxBounds(bounds);
        this.map.fitBounds(bounds, animOptions);
        this.__onlyShowISO_3166_2 = iso_3166_2;
      }

      this._onControlsChange();
    };
    runMe();
  }

  /**
   * Map controls changed (e.g. the datatype or day period changed)
   * so invalidate caches and re-render with the new params
   *
   * @private
   */
  _onControlsChange() {
    this.__resetPointsData(true);
    this.__resetPolyData();

    if (this.clusteredCaseSource && this.casesSource) {
      this.onMapMoveChange();
    }
  }

  __resetPointsData(noFade) {
    let points = {
      type: "FeatureCollection",
      features: [],
    };

    if (this.clusteredCaseSource) {
      this.clusteredCaseSource.setData(null, points);
    }

    if (!noFade) {
      if (this.numbersCaseLayer) {
        this.numbersCaseLayer.fadeOut();
      }
      if (this.rateOfChangeCaseLayer) {
        this.rateOfChangeCaseLayer.fadeOut();
      }
      setTimeout(() => {
        if (this.numbersCaseLayer) {
          this.numbersCaseLayer.updateLayer();
        }
        if (this.rateOfChangeCaseLayer) {
          this.rateOfChangeCaseLayer.updateLayer();
        }
      }, 400);
    }
  }

  __resetPolyData() {
    let polygons = {
      type: "FeatureCollection",
      features: [],
    };

    if (this.casesSource) {
      this.casesSource.setData(null, polygons);
    }
  }
}

export default CovidMapControl;
