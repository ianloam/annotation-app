//THIS IS REFERENCE CODE FOR PEN, LABEL, SELECT FUNCTIONALITY
import React, { useEffect, useRef, useState } from "react";
import "ol/ol.css";
import { Map, View } from "ol";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Fill, Stroke, Style } from "ol/style";
import Static from "ol/source/ImageStatic";
import ImageLayer from "ol/layer/Image";
import { fromLonLat } from "ol/proj";
import { Draw } from "ol/interaction";
import { LineString, Polygon } from "ol/geom";
import Feature from "ol/Feature";
import { Point, LinearRing, MultiPoint, MultiLineString, MultiPolygon } from 'ol/geom';
import { Select } from 'ol/interaction';
import * as jsts from "jsts";
import { Text } from 'ol/style';

// Material-UI imports
import {
  Box,
  Button,
  Typography,
  TextField,
  Select as MuiSelect,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Divider
} from '@mui/material';

const App = () => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [vectorSource] = useState(new VectorSource());
  const [vectorLayer, setVectorLayer] = useState(null);
  const [imageLayer, setImageLayer] = useState(null);
  const [select, setSelect] = useState(null);
  const [draw, setDraw] = useState(null);
  const [selectedColor, setSelectedColor] = useState('#0000ff'); // Default blue
  const [drawLabel, setDrawLabel] = useState('DRAWN'); // Default value is DRAWN
  const [crosshairActive, setCrosshairActive] = useState(false); // New state for crosshair
  const currentListener = useRef(null);
  const [brushMode, setBrushMode] = useState('insert'); // 'insert' or 'overwrite'
  const [labelText, setLabelText] = useState('');
  const crosshairRef = useRef(null);

  const getColorFromText = (text) => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = '#' + ('000000' + (hash & 0xFFFFFF).toString(16)).slice(-6);
    return color;
  };

  const startSelecting = () => {
    if (draw) {
      map.removeInteraction(draw);
    }

    const selectInteraction = new Select({
      layers: [vectorLayer],
      style: function(feature) {
        const existingStyle = feature.getStyle();
        const featureColor = feature.getProperties().color || '#0000ff';

        return new Style({
          stroke: new Stroke({
            color: 'yellow',
            width: 3
          }),
          fill: new Fill({ color: featureColor + '66' }),

        });
      }
    });

    map.addInteraction(selectInteraction);
    setSelect(selectInteraction);
  };

  useEffect(() => {
    const vectorLayerInstance = new VectorLayer({
      source: vectorSource,
      style: new Style({
        stroke: new Stroke({ color: "#000000", width: 2 }),
        fill: new Fill({ color: "rgba(255, 255, 255, 0.4)" }),
      }),
    });

    const mapInstance = new Map({
      target: mapRef.current,
      layers: [vectorLayerInstance],
      view: new View({
        center: fromLonLat([0, 0]),
        zoom: 2,
        maxZoom: 5,
      }),
    });

    setMap(mapInstance);
    setVectorLayer(vectorLayerInstance);

    return () => mapInstance.setTarget(null);
  }, []);

  // Add function to toggle crosshair
  const toggleCrosshair = () => {
    setCrosshairActive(!crosshairActive);
  };

  // Add function to update crosshair position
  const updateCrosshair = (e) => {
    if (!crosshairActive || !crosshairRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    crosshairRef.current.style.left = `${x}px`;
    crosshairRef.current.style.top = `${y}px`;
  };

  // Add effect to handle crosshair visibility and mouse movement
  useEffect(() => {
    if (!mapRef.current) return;

    const handleMouseMove = (e) => {
      updateCrosshair(e);
    };

    if (crosshairActive) {
      mapRef.current.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      mapRef.current?.removeEventListener('mousemove', handleMouseMove);
    };
  }, [crosshairActive]);

  const displayImage = (file) => {
    if (!file || !map) return;

    const url = URL.createObjectURL(file);

    const img = new Image();
    img.onload = () => {
      const width = img.width;
      const height = img.height;

      // Calculate extent to maintain aspect ratio
      const aspectRatio = width / height;
      const mapHeight = 10000000; // Arbitrary height for EPSG:3857 projection
      const mapWidth = mapHeight * aspectRatio;
      const imageExtent = [0, 0, mapWidth, mapHeight];

      // Remove the existing image layer, if any
      if (imageLayer) {
        map.removeLayer(imageLayer);
      }

      const newImageLayer = new ImageLayer({
        source: new Static({
          url,
          imageExtent,
        }),
      });

      map.addLayer(newImageLayer);
      setImageLayer(newImageLayer);

      // Ensure the vector layer is on top
      if (vectorLayer) {
        map.removeLayer(vectorLayer);
        map.addLayer(vectorLayer);
      }

      map.getView().fit(imageExtent, { size: map.getSize(), padding: [20, 20, 20, 20] });
    };

    img.src = url;
  };

  const activateBrushTool = () => {
    if (!map) return;

    // Remove all existing interactions
    map.getInteractions().forEach(interaction => {
      if (interaction instanceof Draw || interaction instanceof Select) {
        map.removeInteraction(interaction);
      }
    });
    const drawWidth = 20;
    const zoomLevel = map.getView().getZoom();
    const zoomFactor = Math.pow(4 / zoomLevel, 2);

    const draw = new Draw({
      source: vectorSource,
      type: 'LineString',
      freehand: true,
      style: new Style({
        stroke: new Stroke({
          color: 'blue',
          width: drawWidth
        })
      })
    });

    vectorSource.on('addfeature', (event) => {
      if (event.feature.getGeometry().getType() === 'LineString') {
        const parser = new jsts.io.OL3Parser();
        parser.inject(
          Point,
          LineString,
          LinearRing,
          Polygon,
          MultiPoint,
          MultiLineString,
          MultiPolygon
        );

        const lineString = parser.read(event.feature.getGeometry());
        const bufferSize = ((200000 * 20) / 40) *
          Math.pow(4 / map.getView().getZoom(), 2); // Dynamic buffer size based on zoom
        const buffer = lineString.buffer(bufferSize);
        const bufferedFeature = new Feature({
          geometry: new Polygon(parser.write(buffer).getCoordinates())
        });

        let unionGeometry = parser.read(bufferedFeature.getGeometry());
        vectorSource.getFeatures().forEach(f => {
          const targetGeometry = parser.read(f.getGeometry());
          if (unionGeometry.intersects(targetGeometry)) {
            unionGeometry = unionGeometry.union(targetGeometry);
            vectorSource.removeFeature(f);
          }
        });

        const finalFeature = new Feature({
          geometry: parser.write(unionGeometry)
        });
        finalFeature.setStyle(new Style({
          stroke: new Stroke({ color: '#0000ff', width: 1 }),
          fill: new Fill({ color: '#0000ff66' })
        }));
        vectorSource.addFeature(finalFeature);      }
    });

    map.addInteraction(draw);
  };

  const activateLabeledBrushTool = () => {
    if (!map) return;

    clearInteractions();
    const ccc = getColorFromText(drawLabel);
    const draw = new Draw({
      source: vectorSource,
      type: 'LineString',
      freehand: true,
      style: new Style({
        stroke: new Stroke({
          color: ccc,
          width: 20
        })
      })
    });

    // Store the new listener
    const listener = (event) => {
      if (event.feature.getGeometry().getType() === 'LineString') {
        const parser = new jsts.io.OL3Parser();
        parser.inject(
          Point,
          LineString,
          LinearRing,
          Polygon,
          MultiPoint,
          MultiLineString,
          MultiPolygon
        );

        const lineString = parser.read(event.feature.getGeometry());
        const bufferSize = ((200000 * 20) / 40) * Math.pow(4 / map.getView().getZoom(), 2);
        const buffer = lineString.buffer(bufferSize);
        let newGeometry = buffer;

        let unionGeometry = parser.read(new Feature({
          geometry: parser.write(newGeometry)
        }).getGeometry());
        vectorSource.getFeatures().forEach(f => {
          if (f.getGeometry().getType() === 'LineString') {
            vectorSource.removeFeature(event.feature);
          }
          const targetGeometry = parser.read(f.getGeometry());
          if (unionGeometry.intersects(targetGeometry)) {
            const style = f.getStyle();
            if (style && style.getText()) {
              if(style.getText().getText() == drawLabel){
                unionGeometry = unionGeometry.union(targetGeometry);
                vectorSource.removeFeature(f);
              } else {
                if(brushMode === 'insert') {
                  // Insert mode - don't interfere with other labels
                  unionGeometry = unionGeometry.difference(targetGeometry);
                } else {
                  // Overwrite mode - only erase the intersecting part
                  const remainingGeometry = targetGeometry.difference(unionGeometry);
                  if (!remainingGeometry.isEmpty()) {
                    const newFeature = new Feature({
                      geometry: parser.write(remainingGeometry)
                    });
                    newFeature.setStyle(style);
                    vectorSource.removeFeature(f);
                    vectorSource.addFeature(newFeature);
                  } else {
                    vectorSource.removeFeature(f);
                  }
                }
              }
            }
          }
        });

        const finalFeature = new Feature({
          geometry: parser.write(unionGeometry)
        });

        finalFeature.setStyle(new Style({
          stroke: new Stroke({ color: '#000000', width: 1 }),
          fill: new Fill({ color: ccc+"66" }),
          text: new Text({
            text: drawLabel,
            fill: new Fill({ color: '#000000' }),
            stroke: new Stroke({ color: '#ffffff', width: 3 }),
            font: '16px Arial',
            offsetY: -15,
            overflow: true
          })
        }));

        vectorSource.addFeature(finalFeature);
      }
    };
    currentListener.current = listener;
    vectorSource.on('addfeature', listener);

    map.addInteraction(draw);
    setDraw(draw);
  };
  const clearInteractions = () => {
    if (!map) return;

    map.getInteractions().forEach(interaction => {
      if (interaction instanceof Draw || interaction instanceof Select) {
        map.removeInteraction(interaction);
      }
    });

    // Remove the current listener if it exists
    if (currentListener.current) {
      vectorSource.un('addfeature', currentListener.current);
      currentListener.current = null;
    }

    setDraw(null);
    setSelect(null);
  };
  const activateEraseTool = () => {
    if (!map) return;

    // Remove all existing interactions
    map.getInteractions().forEach(interaction => {
      if (interaction instanceof Draw || interaction instanceof Select) {
        map.removeInteraction(interaction);
      }
    });
    const drawWidth = 20;
    const draw = new Draw({
      source: vectorSource,
      type: 'LineString',
      freehand: true,
      style: new Style({
        stroke: new Stroke({
          color: 'red',
          width: drawWidth
        })
      })
    });

    vectorSource.on('addfeature', (event) => {
      if (event.feature.getGeometry().getType() === 'LineString') {
        const parser = new jsts.io.OL3Parser();
        parser.inject(
          Point,
          LineString,
          LinearRing,
          Polygon,
          MultiPoint,
          MultiLineString,
          MultiPolygon
        );

        const lineString = parser.read(event.feature.getGeometry());
        const bufferSize = ((200000 * 20) / 40) * Math.pow(4 / map.getView().getZoom(), 2);
        const eraseBuffer = lineString.buffer(bufferSize);

        vectorSource.getFeatures().forEach(f => {
          const targetGeometry = parser.read(f.getGeometry());
          if (eraseBuffer.intersects(targetGeometry)) {
            const remainingGeometry = targetGeometry.difference(eraseBuffer);
            if (!remainingGeometry.isEmpty()) {
              const style = f.getStyle();
              const newFeature = new Feature({
                geometry: parser.write(remainingGeometry)
              });
              newFeature.setStyle(style);
              vectorSource.removeFeature(f);
              vectorSource.addFeature(newFeature);
            } else {
              vectorSource.removeFeature(f);
            }
          }
        });
      }
    });

    map.addInteraction(draw);
  };  const startLassoSelect = () => {
    if (draw) {
      map.removeInteraction(draw);
    }

    // Initialize select interaction if it doesn't exist
    if (!select) {
      const selectInteraction = new Select({
        layers: [vectorLayer],
        style: function(feature) {
          const existingStyle = feature.getStyle();
          const featureColor = feature.getProperties().color || '#0000ff';
          return new Style({
            stroke: new Stroke({ color: 'yellow', width: 3 }),
            fill: new Fill({ color: featureColor + '66' }),
          });
        }
      });
      map.addInteraction(selectInteraction);
      setSelect(selectInteraction);
    }

    const lassoInteraction = new Draw({
      source: new VectorSource(), // Create a temporary source for the lasso
      type: 'Polygon',
      freehand: true,
      style: new Style({
        stroke: new Stroke({ color: 'yellow', width: 2 }),
        fill: new Fill({ color: 'rgba(255, 255, 0, 0.2)' })
      })
    });

    lassoInteraction.on('drawend', (event) => {
      const lassoFeature = event.feature;
      const parser = new jsts.io.OL3Parser();
      parser.inject(Point, LineString, LinearRing, Polygon, MultiPoint, MultiLineString, MultiPolygon);

      const lassoGeom = parser.read(lassoFeature.getGeometry());
      const selectedFeatures = [];

      vectorSource.getFeatures().forEach(feature => {
        const featureGeom = parser.read(feature.getGeometry());
        if (lassoGeom.intersects(featureGeom)) {
          selectedFeatures.push(feature);
        }
      });

      select.getFeatures().clear();
      selectedFeatures.forEach(feature => {
        select.getFeatures().push(feature);
      });

      // Remove the lasso interaction after selection
      map.removeInteraction(lassoInteraction);
    });

    map.addInteraction(lassoInteraction);
  };  const loadDefaultImage1 = () => {
    const imageUrl = '221_G2_1_red_green.jpg';
    const img = new Image();
    img.onload = () => {
      const width = img.width;
      const height = img.height;
      const aspectRatio = width / height;
      const mapHeight = 10000000;
      const mapWidth = mapHeight * aspectRatio;
      const imageExtent = [0, 0, mapWidth, mapHeight];

      if (imageLayer) {
        map.removeLayer(imageLayer);
      }

      const newImageLayer = new ImageLayer({
        source: new Static({
          url: imageUrl,
          imageExtent,
        }),
      });

      map.addLayer(newImageLayer);
      setImageLayer(newImageLayer);

      if (vectorLayer) {
        map.removeLayer(vectorLayer);
        map.addLayer(vectorLayer);
      }

      map.getView().fit(imageExtent, { size: map.getSize(), padding: [20, 20, 20, 20] });
    };
    img.src = imageUrl;
  };

  // Add function to activate draw box tool
  const activateDrawBox = () => {
    if (!map) return;

    // Clear existing interactions
    clearInteractions();

    // Enable crosshair
    setCrosshairActive(true);

    // Create box drawing interaction
    const boxDraw = new Draw({
      source: vectorSource,
      type: 'Polygon',
      style: new Style({
        stroke: new Stroke({
          color: selectedColor,
          width: 2
        }),
        fill: new Fill({
          color: selectedColor + '66'
        })
      })
    });

    // Handle box drawing completion
    boxDraw.on('drawend', (event) => {
      // Remove the drawing interaction but keep crosshair
      map.removeInteraction(boxDraw);
      setDraw(null);
    });

    map.addInteraction(boxDraw);
    setDraw(boxDraw);
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <Paper
        elevation={3}
        sx={{
          width: "300px",
          padding: "20px",
          backgroundColor: "#f4f4f4",
          overflow: "auto"
        }}
      >

        <Button
          variant="contained"
          component="label"
          fullWidth
          sx={{ mb: 2 }}
        >
          Choose File
          <input
            type="file"
            accept="image/jpeg, image/png"
            onChange={(e) => displayImage(e.target.files[0])}
            hidden
          />
        </Button>

        <Button
          variant="contained"
          fullWidth
          onClick={activateBrushTool}
          sx={{ mb: 1 }}
        >
          Activate Brush Tool
        </Button>

        <Button
          variant="contained"
          fullWidth
          onClick={toggleCrosshair}
          color={crosshairActive ? "secondary" : "primary"}
          sx={{ mb: 1 }}
        >
          {crosshairActive ? "Disable Crosshair" : "Enable Crosshair"}
        </Button>

        <Button
          variant="contained"
          fullWidth
          onClick={activateDrawBox}
          sx={{ mb: 1 }}
        >
          Draw Box
        </Button>

        <Divider sx={{ my: 2 }} />

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Brush Mode</InputLabel>
          <MuiSelect
            value={brushMode}
            onChange={(e) => setBrushMode(e.target.value)}
            label="Brush Mode"
          >
            <MenuItem value="insert">Insert</MenuItem>
            <MenuItem value="overwrite">Overwrite</MenuItem>
          </MuiSelect>
        </FormControl>

        <TextField
          fullWidth
          label="Draw Label"
          value={drawLabel}
          onChange={(e) => setDrawLabel(e.target.value)}
          placeholder="Enter label for drawing"
          sx={{ mb: 2 }}
        />

        <Button
          variant="contained"
          fullWidth
          onClick={activateLabeledBrushTool}
          sx={{ mb: 1 }}
        >
          Labeled Brush Tool
        </Button>

        <Button
          variant="outlined"
          fullWidth
          onClick={clearInteractions}
          color="error"
          sx={{ mb: 1 }}
        >
          Clear Tools
        </Button>

        <Button
          variant="contained"
          fullWidth
          onClick={startSelecting}
          sx={{ mb: 1 }}
        >
          Select Features
        </Button>

        <Button
          variant="contained"
          fullWidth
          onClick={startLassoSelect}
          sx={{ mb: 1 }}
        >
          Lasso Select
        </Button>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          Notes:
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={4}
          placeholder="Add your notes here..."
          sx={{ mb: 2 }}
        />

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          Add Label
        </Typography>
        <TextField
          fullWidth
          list="labelOptions"
          value={labelText}
          placeholder="Enter or select label"
          onChange={(e) => setLabelText(e.target.value)}
          sx={{ mb: 1 }}
        />
        <datalist id="labelOptions">
          <option value="Label 1" />
          <option value="Label 2" />
          <option value="Label 3" />
          <option value="Apple 1" />
          <option value="Apple 2" />
          <option value="Apple 3" />
        </datalist>
        <Button
          variant="contained"
          fullWidth
          onClick={() => {
            if (select && labelText) {
              const selectedFeatures = select.getFeatures();
              selectedFeatures.forEach(feature => {
                const featureColor = feature.getProperties().color || '#0000ff';
                const newStyle = new Style({
                  stroke: new Stroke({ color: featureColor, width: 1 }),
                  fill: new Fill({ color: featureColor + '66' }),
                  text: new Text({
                    text: labelText,
                    fill: new Fill({ color: '#000000' }),
                    stroke: new Stroke({ color: '#ffffff', width: 3 }),
                    font: '16px Arial',
                    offsetY: -15,
                    overflow: true
                  })
                });
                feature.setStyle(newStyle);
              });
              setLabelText('');
            }
          }}
          sx={{ mb: 1 }}
        >
          Add Label
        </Button>

        <Button
          variant="contained"
          fullWidth
          onClick={activateEraseTool}
          color="error"
        >
          Erase Tool
        </Button>
      </Paper>

      <div style={{ flex: 1, position: 'relative' }} ref={mapRef}>
        {crosshairActive && (
          <div
            ref={crosshairRef}
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              zIndex: 1000,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '-100vw',
                top: '0',
                width: '200vw',
                height: '2px',
                backgroundColor: 'black',
                opacity: 0.7,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '0',
                top: '-100vh',
                width: '2px',
                height: '200vh',
                backgroundColor: 'black',
                opacity: 0.7,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
export default App;
