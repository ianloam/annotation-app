import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import Map from 'ol/Map';
import View from 'ol/View';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Stroke, Fill } from 'ol/style';
import { LineString, Polygon } from 'ol/geom';
import Feature from 'ol/Feature';
import { Draw } from 'ol/interaction';
import { Point, LinearRing, MultiPoint, MultiLineString, MultiPolygon } from 'ol/geom';
import { Select } from 'ol/interaction';
import { Text } from 'ol/style';
import ImageLayer from 'ol/layer/Image';
import Static from 'ol/source/ImageStatic';
import { getCenter } from 'ol/extent';
import { fromLonLat } from 'ol/proj';
const jsts = window.jsts;
const jstsParser = new jsts.io.OL3Parser();
jstsParser.inject(
  Point,
  LineString,
  LinearRing,
  Polygon,
  MultiPoint,
  MultiLineString,
  MultiPolygon
);

const MapView = ({
  mapRef,
  crosshairActive,
  crosshairRef,
  updateCrosshair,
  uploadedImage,
  annotations,
  onAnnotationAdd,
  currentLabel,
  penSize,
  drawingMode,
  penMode
}) => {
  const mapTargetRef = useRef(null);
  const [map, setMap] = useState(null);
  const vectorSourceRef = useRef(new VectorSource());
  const [vectorLayer, setVectorLayer] = useState(null);
  const [imageLayer, setImageLayer] = useState(null);
  const [drawInteraction, setDrawInteraction] = useState(null);
  const [selectInteraction, setSelectInteraction] = useState(null);
  const [featureHistory, setFeatureHistory] = useState([]);

  // Initialize the map
  useEffect(() => {
    const vectorLayerInstance = new VectorLayer({
      source: vectorSourceRef.current,
      style: new Style({
        stroke: new Stroke({ color: "#000000", width: 2 }),
        fill: new Fill({ color: "rgba(255, 255, 255, 0.4)" }),
      }),
    });

    const mapInstance = new Map({
      target: mapTargetRef.current,
      layers: [vectorLayerInstance],
      view: new View({
        center: fromLonLat([0, 0]),
        zoom: 2,
        maxZoom: 20,
      }),
    });

    setMap(mapInstance);
    setVectorLayer(vectorLayerInstance);
    mapRef.current = mapInstance;

    return () => mapInstance.setTarget(undefined);
  }, []);

  // Handle drawing mode changes
  useEffect(() => {
    if (!map) return;

    // Clear existing interactions
    map.getInteractions().forEach(interaction => {
      if (interaction instanceof Draw || interaction instanceof Select) {
        map.removeInteraction(interaction);
      }
    });

    // Set up new interactions based on drawing mode
    if (drawingMode === 'pen') {
      setupPenTool();
    } else if (drawingMode === 'bbox') {
      setupBoxTool();
    }
  }, [drawingMode, penMode, penSize, currentLabel]);

  // Handle image upload
  useEffect(() => {
    if (!uploadedImage || !map) return;
    displayImage(uploadedImage);
  }, [uploadedImage, map]);

  // Handle annotations from parent
  useEffect(() => {
    if (!map || !vectorSourceRef.current) return;

    // Clear existing features
    vectorSourceRef.current.clear();

    // Add new features
    annotations.forEach(annotation => {
      if (annotation.type === 'bbox') {
        const bboxFeature = createBBoxFeature(annotation);
        vectorSourceRef.current.addFeature(bboxFeature);
      } else if (annotation.type === 'pen') {
        const penFeature = createPenFeature(annotation);
        vectorSourceRef.current.addFeature(penFeature);
      }
    });
  }, [annotations]);

  const getColorFromText = (text) => {
    if (!text) return '#000000';
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    return '#' + ('000000' + (hash & 0xFFFFFF).toString(16)).slice(-6);
  };

  const displayImage = (imageUrl) => {
    if (!map) return;

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

  const setupPenTool = () => {
    if (!map) return;

    const color = getColorFromText(currentLabel);
    const draw = new Draw({
      source: vectorSourceRef.current,
      type: 'LineString',
      freehand: true,
      style: new Style({
        stroke: new Stroke({
          color: color,
          width: 20
        })
      })
    });

    draw.on('drawstart', () => {
      // Save current state for undo
      setFeatureHistory([...vectorSourceRef.current.getFeatures()]);
    });
    vectorSourceRef.current.on('addfeature', (event) => {
      if (event.feature.getGeometry().getType() === 'LineString') {
          const lineString = jstsParser.read(event.feature.getGeometry());
          const bufferSize = ((200000 * 20) / 40) *
          Math.pow(4 / map.getView().getZoom(), 2); // Dynamic buffer size based on zoom
          const buffer = lineString.buffer(bufferSize);
          const bufferedFeature = new Feature({
              geometry: new Polygon(jstsParser.write(buffer).getCoordinates())
          });
          let unionGeometry = jstsParser.read(bufferedFeature.getGeometry());
          vectorSourceRef.current.getFeatures().forEach(f => {
          const targetGeometry = jstsParser.read(f.getGeometry());
              if (unionGeometry.intersects(targetGeometry)) {
                  unionGeometry = unionGeometry.union(targetGeometry);
                  vectorSourceRef.current.removeFeature(f);
              }
          });
          const finalFeature = new Feature({
              geometry: jstsParser.write(unionGeometry)
          });
          finalFeature.setStyle(new Style({
              stroke: new Stroke({ color: '#0000ff', width: 1 }),
              fill: new Fill({ color: '#0000ff66' })
          }));
          vectorSourceRef.current.addFeature(finalFeature);      }
    });

    map.addInteraction(draw);
  };/*


    draw.on('drawend', (event) => {
      const feature = event.feature;
      const lineString = feature.getGeometry();

      // Buffer the line to create a polygon
        const bufferSize = (10000 * penSize); /// 2 * Math.pow(4 / map.getView().getZoom(), 2);
      const buffer = jstsParser.read(lineString).buffer(bufferSize);
      const bufferedGeom = jstsParser.write(buffer);

      // Create new feature with buffered geometry
      const bufferedFeature = new Feature({
        geometry: bufferedGeom,
        type: 'pen',
        label: currentLabel,
        color: color,
        penSize: penSize
      });

      // Apply style
      bufferedFeature.setStyle(createPenStyle(currentLabel, color));

      // Remove the temporary line feature
      vectorSourceRef.current.removeFeature(feature);

      // Add the buffered polygon
      vectorSourceRef.current.addFeature(bufferedFeature);

      // Notify parent
      onAnnotationAdd({
        id: Date.now(),
        type: 'pen',
        label: currentLabel,
        color: color,
        penSize: penSize,
        geometry: bufferedGeom.getCoordinates()
      });
    });

    map.addInteraction(draw);
    setDrawInteraction(draw);
  };*/

  const setupBoxTool = () => {
    if (!map) return;

    const color = getColorFromText(currentLabel);
    const draw = new Draw({
      source: vectorSourceRef.current,
      type: 'Polygon',
      style: new Style({
        stroke: new Stroke({
          color: color,
          width: 2
        }),
        fill: new Fill({
          color: color + '66'
        })
      })
    });

    draw.on('drawstart', () => {
      // Save current state for undo
      setFeatureHistory([...vectorSourceRef.current.getFeatures()]);
    });

    draw.on('drawend', (event) => {
      const feature = event.feature;

      // Set properties
      feature.set('type', 'bbox');
      feature.set('label', currentLabel);
      feature.set('color', color);

      // Apply style
      feature.setStyle(createBBoxStyle(currentLabel, color));

      // Notify parent
      onAnnotationAdd({
        id: Date.now(),
        type: 'bbox',
        label: currentLabel,
        color: color,
        geometry: feature.getGeometry().getCoordinates()
      });
    });

    map.addInteraction(draw);
    setDrawInteraction(draw);
  };

  const createPenStyle = (label, color) => {
    return new Style({
      stroke: new Stroke({ color: '#000000', width: 1 }),
      fill: new Fill({ color: color + '66' }),
      text: label ? new Text({
        text: label,
        fill: new Fill({ color: '#000000' }),
        stroke: new Stroke({ color: '#ffffff', width: 3 }),
        font: 'bold 16px Arial',
        offsetY: -15,
        overflow: true
      }) : undefined
    });
  };

  const createBBoxStyle = (label, color) => {
    return new Style({
      stroke: new Stroke({ color: '#000000', width: 1 }),
      fill: new Fill({ color: color + '66' }),
      text: label ? new Text({
        text: label,
        fill: new Fill({ color: '#000000' }),
        stroke: new Stroke({ color: '#ffffff', width: 3 }),
        font: 'bold 16px Arial',
        offsetY: -15,
        overflow: true
      }) : undefined
    });
  };

  const createBBoxFeature = (annotation) => {
    const feature = new Feature({
      geometry: new Polygon([annotation.geometry]),
      type: 'bbox',
      label: annotation.label,
      color: annotation.color
    });
    feature.setStyle(createBBoxStyle(annotation.label, annotation.color));
    return feature;
  };

  const createPenFeature = (annotation) => {
    const feature = new Feature({
      geometry: new Polygon([annotation.geometry]),
      type: 'pen',
      label: annotation.label,
      color: annotation.color,
      penSize: annotation.penSize
    });
    feature.setStyle(createPenStyle(annotation.label, annotation.color));
    return feature;
  };

  // Expose functions to parent via ref
  React.useImperativeHandle(mapRef, () => ({
    clearAnnotations: () => {
      vectorSourceRef.current.clear();
      setFeatureHistory([]);
    },
    undoLastAnnotation: () => {
      if (featureHistory.length > 0) {
        vectorSourceRef.current.clear();
        featureHistory.forEach(feat => vectorSourceRef.current.addFeature(feat));
      }
    },
    getAnnotations: () => {
      return vectorSourceRef.current.getFeatures().map(feature => {
        const props = feature.getProperties();
        return {
          id: props.id || Date.now(),
          type: props.type,
          label: props.label,
          color: props.color,
          penSize: props.penSize,
          geometry: feature.getGeometry().getCoordinates()
        };
      });
    }
  }));

  return (
    <Box
      ref={mapTargetRef}
      sx={{
        width: '100%',
        height: '100%',
        backgroundColor: '#f5f5f5',
        minHeight: '100vh',
        position: 'relative',
        cursor: drawingMode === 'pen' ? 'crosshair' : drawingMode === 'bbox' ? 'crosshair' : 'default',
        overflow: 'hidden',
      }}
      onMouseMove={updateCrosshair}
    >
      {!uploadedImage && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#666',
            zIndex: 0
          }}
        >
          <Typography variant="h6">Upload an image to start annotating</Typography>
          <Typography variant="body2">Click "Upload Image" in the sidebar</Typography>
        </Box>
      )}

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
    </Box>
  );
};

export default MapView;
