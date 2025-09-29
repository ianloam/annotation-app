import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import Map from 'ol/Map';
import View from 'ol/View';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Stroke, Fill, Circle } from 'ol/style';
import { LineString, Polygon, Point, LinearRing, MultiPoint, MultiLineString, MultiPolygon } from 'ol/geom';
import Feature from 'ol/Feature';
import Draw, { createBox } from 'ol/interaction/Draw';
import Select from 'ol/interaction/Select';
import { Text } from 'ol/style';
import ImageLayer from 'ol/layer/Image';
import Static from 'ol/source/ImageStatic';
import { fromLonLat } from 'ol/proj';

// JSTS is loaded via CDN in index.html
const jsts = window.jsts;
const jstsParser = new jsts.io.OL3Parser();
jstsParser.inject(Point, LineString, LinearRing, Polygon, MultiPoint, MultiLineString, MultiPolygon);

const MapView = ({
  mapRef,
  crosshairActive,
  uploadedImage,
  annotations,
  onAnnotationAdd,
  onAnnotationsChange,
  currentLabel,
  penSize,
  drawingMode,
  penMode,          // 'add' (insert) | 'subtract' (overwrite) | 'move'
  labels,
  labelColors
}) => {
  const mapTargetRef = useRef(null);
  const [map, setMap] = useState(null);
  const vectorSourceRef = useRef(new VectorSource());
  const [vectorLayer, setVectorLayer] = useState(null);
  const [imageLayer, setImageLayer] = useState(null);
  const [featureHistory, setFeatureHistory] = useState([]);
  const [selectInteraction, setSelectInteraction] = useState(null);

  const makeSelectStyle = (feature) => {
    const type = feature.get('type');
    const featureColor = feature.get('color') || '#000000';

    if (type === 'point') {
      return new Style({
        image: new Circle({
          radius: 6,
          fill: new Fill({ color: featureColor }),
          stroke: new Stroke({ color: 'yellow', width: 3 })
        })
      });
    }

    // pen/bbox fallback
    return new Style({
      stroke: new Stroke({ color: 'yellow', width: 3 }),
      fill: new Fill({ color: featureColor + '66' })
    });
  };

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
    mapInstance.updateSize();

    return () => mapInstance.setTarget(undefined);
  }, []);

  // Handle drawing mode changes
  useEffect(() => {
    if (!map) return;

    // Clear existing draw interactions
    map.getInteractions().forEach(interaction => {
      if (interaction instanceof Draw) {
        map.removeInteraction(interaction);
      }
    });

    if (drawingMode === 'pen') {
      setupPenTool();
    } else if (drawingMode === 'bbox') {
      setupBoxTool();
    } else if (drawingMode === 'point') {
      setupPointTool();
    }
  }, [drawingMode, penMode, penSize, currentLabel]);

  // Handle image upload
  useEffect(() => {
    if (!uploadedImage || !map) return;
    displayImage(uploadedImage);
  }, [uploadedImage, map]);

  // ---------- Helpers ----------
  const toOlPolygonOrMulti = (coords) => {
    // coords can be Polygon (rings) or MultiPolygon (array of polygons -> rings)
    const isMulti =
      Array.isArray(coords) &&
      Array.isArray(coords[0]) &&
      Array.isArray(coords[0][0]) &&
      Array.isArray(coords[0][0][0]) &&
      Array.isArray(coords[0][0][0][0]);
    return isMulti ? new MultiPolygon(coords) : new Polygon(coords);
  };

  const getColorFromLabel = (label) => {
    if (label === '') return '#ffffff';
    const index = labels.indexOf(label);
    return index === -1 ? '#000000' : labelColors[index % labelColors.length];
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
        source: new Static({ url: imageUrl, imageExtent }),
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

  // ---------- Drawing tools ----------
  const setupPenTool = () => {
    if (!map) return;
    if (penMode === 'move') return; // allow panning

    const color = getColorFromLabel(currentLabel);
    const draw = new Draw({
      source: vectorSourceRef.current,
      type: 'LineString',
      freehand: true,
      style: new Style({
        stroke: new Stroke({ color, width: penSize })
      })
    });

    draw.on('drawstart', () => {
      // Save display-state snapshot for undo of the rendered vector layer
      setFeatureHistory([...vectorSourceRef.current.getFeatures()]);
    });

    draw.on('drawend', (event) => {
      const feature = event.feature;
      const lineString = feature.getGeometry();

      try {
        // Buffer the line into a "stroke with area"
        const zoom = map.getView().getZoom();
        let bufferSize = (penSize *18000) / Math.pow(2, zoom - 2);
        const minBuffer = 1000; // prevent degenerate geometries
        bufferSize = Math.max(bufferSize, minBuffer);

        const buffer = jstsParser.read(lineString).buffer(bufferSize);
        const bufferedGeom = jstsParser.write(buffer);

        // Remove the temporary line feature from OL layer (we only render from annotations)
        vectorSourceRef.current.removeFeature(feature);

        // Store the stroke as an annotation, with penMode to drive label interaction rules
        onAnnotationAdd({
          id: Date.now(),
          type: 'pen',
          penMode,               // 'add' (insert) or 'subtract' (overwrite)
          label: currentLabel,
          color,
          penSize,
          geometry: bufferedGeom.getCoordinates() // rings / multipolygon
        });
      } catch (error) {
        console.error('Pen tool buffering failed:', error);
        // No fallback here; we rely on buffered polygons for consistent geometry math
      }
    });

    map.addInteraction(draw);
  };

  const setupBoxTool = () => {
    if (!map) return;

    const color = getColorFromLabel(currentLabel);
    const draw = new Draw({
      source: vectorSourceRef.current,
      type: 'Circle',
      geometryFunction: createBox(),
      style: new Style({
        stroke: new Stroke({ color: '#000000', width: 2 }),
        fill: new Fill({ color: color + 'AA' })
      })
    });

    draw.on('drawstart', () => {
      setFeatureHistory([...vectorSourceRef.current.getFeatures()]);
    });

    draw.on('drawend', (event) => {
      const feature = event.feature;

      feature.set('type', 'bbox');
      feature.set('label', currentLabel);
      feature.set('color', color);
      feature.setStyle(createBBoxStyle(currentLabel, color));

      onAnnotationAdd({
        id: Date.now(),
        type: 'bbox',
        label: currentLabel,
        color,
        geometry: feature.getGeometry().getCoordinates()
      });
    });

    map.addInteraction(draw);
  };

  const setupPointTool = () => {
    if (!map) return;

    const color = getColorFromLabel(currentLabel);
    const draw = new Draw({
      source: vectorSourceRef.current,
      type: 'Point',
      style: new Style({
        image: new Circle({
          radius: 6,
          fill: new Fill({ color }),
          stroke: new Stroke({ color: '#000000', width: 2 })
        })
      })
    });

    draw.on('drawstart', () => {
      setFeatureHistory([...vectorSourceRef.current.getFeatures()]);
    });

    draw.on('drawend', (event) => {
      const feature = event.feature;

      feature.set('type', 'point');
      feature.set('label', currentLabel);
      feature.set('color', color);
      feature.setStyle(createPointStyle(currentLabel, color));

      onAnnotationAdd({
        id: Date.now(),
        type: 'point',
        label: currentLabel,
        color,
        geometry: feature.getGeometry().getCoordinates()
      });
    });

    map.addInteraction(draw);
  };

  const setupSelectTool = () => {
    if (!map) return;

    // Remove existing select interaction and its handlers
    if (selectInteraction) {
      map.removeInteraction(selectInteraction);
      const oldHandler = selectInteraction.get('singleClickHandler');
      if (oldHandler) {
        map.un('singleclick', oldHandler);
      }
    }

    const select = new Select({
      layers: [vectorLayer],
      style: makeSelectStyle
    });

    map.addInteraction(select);
    setSelectInteraction(select);

    // Handle precise pen stroke selection via hit testing
    const handleSingleClick = (evt) => {
      const coord = evt.coordinate;

      // Check annotations one by one for pen strokes
      for (const a of annotations) {
        if (a.type !== 'pen') continue;

        try {
          const geom = jstsParser.read(toOlPolygonOrMulti(a.geometry));
          const clickPoint = new jsts.geom.Point(new jsts.geom.Coordinate(coord[0], coord[1]));
          if (geom.contains(clickPoint)) {
            // Found the clicked annotation - remove it
            if (onAnnotationsChange) {
              onAnnotationsChange(prev => prev.filter(x => x.id !== a.id));
            }
            break;
          }
        } catch (e) {
          console.error('Hit test failed for annotation', a.id, e);
        }
      }
    };

    map.on('singleclick', handleSingleClick);

    // Store the handler for cleanup
    select.set('singleClickHandler', handleSingleClick);

    // Optional: log or forward selected features to parent
    select.on('select', (e) => {
      console.log('Selected features:', e.selected);
    });
  };

  const setupLassoSelect = () => {
    if (!map) return;

    // Remove existing draw/select interactions
    map.getInteractions().forEach(interaction => {
      if (interaction instanceof Draw || interaction instanceof Select) {
        map.removeInteraction(interaction);
      }
    });

    // Keep a fresh Select interaction (so results are visible)
    const select = new Select({
      layers: [vectorLayer],
      style: makeSelectStyle
    });
    map.addInteraction(select);
    setSelectInteraction(select);

    // Temporary source for lasso drawing
    const lassoSource = new VectorSource();
    const lassoInteraction = new Draw({
      source: lassoSource,
      type: 'Polygon',
      freehand: true,
      style: new Style({
        stroke: new Stroke({ color: 'yellow', width: 2 }),
        fill: new Fill({ color: 'rgba(255, 255, 0, 0.2)' })
      })
    });

    lassoInteraction.on('drawend', (evt) => {
      try {
        const lassoGeomJsts = jstsParser.read(evt.feature.getGeometry());
        const feats = vectorSourceRef.current.getFeatures();

        const matches = feats.filter((f) => {
          try {
            const g = jstsParser.read(f.getGeometry());
            // robust predicate for curves/edges/points
            return (
              lassoGeomJsts.intersects(g) ||
              lassoGeomJsts.contains(g) ||
              g.contains(lassoGeomJsts) ||
              lassoGeomJsts.touches(g)
            );
          } catch (e) {
            return false;
          }
        });

        select.getFeatures().clear();
        matches.forEach((f) => select.getFeatures().push(f));
      } catch (e) {
        console.error('Lasso select failed:', e);
      } finally {
        map.removeInteraction(lassoInteraction);
      }
    });

    map.addInteraction(lassoInteraction);
  };

  // ---------- Rebuild features from annotations ----------
  // Implements label interaction rules:
  // - Same-label: ALWAYS union.
  // - penMode 'add' (insert): new stroke is clipped by all other labels (does not interfere).
  // - penMode 'subtract' (overwrite): carve new stroke out of other labels, then add to current label.
  useEffect(() => {
    if (!map || !vectorSourceRef.current) return;

    vectorSourceRef.current.clear();

    // 1) Draw non-pen annotations first
    annotations.forEach(a => {
      if (a.type === 'bbox') {
        const bboxFeature = createBBoxFeature({ ...a, color: getColorFromLabel(a.label) });
        vectorSourceRef.current.addFeature(bboxFeature);
      } else if (a.type === 'point') {
        const pointFeature = createPointFeature({ ...a, color: getColorFromLabel(a.label) });
        vectorSourceRef.current.addFeature(pointFeature);
      }
    });

    // 2) Resolve pen annotations with label interaction
    // Process in the order they were created (array order) to mimic drawing sequence
    const labelGeoms = {}; // { label: { geom: jstsGeom, ids: [id1, id2, ...] } }

    const getLabelGeom = (label) => labelGeoms[label]?.geom || null;
    const setLabelGeom = (label, geom, ids = []) => {
      if (!labelGeoms[label]) {
        labelGeoms[label] = { geom, ids };
      } else {
        labelGeoms[label].geom = geom;
        labelGeoms[label].ids = [...(labelGeoms[label].ids || []), ...ids];
      }
    };

    annotations.forEach(a => {
      if (a.type !== 'pen') return;

      let stroke;
      try {
        stroke = jstsParser.read(toOlPolygonOrMulti(a.geometry));
      } catch (e) {
        console.error('Invalid pen geometry, skipping:', e);
        return;
      }

      const label = a.label;
      const mode = a.penMode || 'add'; // default to add if missing
      const current = getLabelGeom(label);

      if (current === null) {
        // First geometry for this label
        if (mode === 'add') {
          // Insert: clip new stroke by ALL OTHER labels before adding
          let clipped = stroke;
          Object.keys(labelGeoms).forEach(otherLabel => {
            if (otherLabel === label) return;
            const other = getLabelGeom(otherLabel);
            if (other && !clipped.isEmpty() && clipped.intersects(other)) {
              clipped = clipped.difference(other);
            }
          });
          if (!clipped.isEmpty()) setLabelGeom(label, clipped, [a.id]);
        } else {
          // Overwrite: carve stroke out of ALL OTHER labels, then add to current label
          Object.keys(labelGeoms).forEach(otherLabel => {
            if (otherLabel === label) return;
            const other = getLabelGeom(otherLabel);
            if (other && stroke.intersects(other)) {
              const diff = other.difference(stroke);
              setLabelGeom(otherLabel, diff.isEmpty() ? null : diff);
            }
          });
          setLabelGeom(label, stroke, [a.id]);
        }
        return;
      }

      // We have existing geometry for this label
      if (mode === 'add') {
        // Same label = union
        let newCurrent = current.union(stroke);

        // Do NOT interfere with other labels: remove overlaps from the stroke portion
        // (Equivalent to clipping the added piece before union, but union after difference is safe too)
        Object.keys(labelGeoms).forEach(otherLabel => {
          if (otherLabel === label) return;
          const other = getLabelGeom(otherLabel);
          if (other && stroke.intersects(other)) {
            // Remove the overlapping area of stroke from the union to preserve other labels intact
            const strokeOnly = stroke.difference(other);
            newCurrent = current.union(strokeOnly);
          }
        });

        setLabelGeom(label, newCurrent, [a.id]);
      } else {
        // mode === 'subtract' (overwrite)
        // First carve the stroke out of ALL other labels
        Object.keys(labelGeoms).forEach(otherLabel => {
          if (otherLabel === label) return;
          const other = getLabelGeom(otherLabel);
          if (other && stroke.intersects(other)) {
            const diff = other.difference(stroke);
            setLabelGeom(otherLabel, diff.isEmpty() ? null : diff);
          }
        });

        // Then union into current label
        setLabelGeom(label, current.union(stroke), [a.id]);
      }
    });

    // 3) Emit OL features per label from the resolved labelGeoms
    Object.keys(labelGeoms).forEach(label => {
      const entry = labelGeoms[label];
      if (!entry || !entry.geom) return;

      const { geom, ids } = entry;
      const color = getColorFromLabel(label);
      try {
        const out = jstsParser.write(geom);
        if (out.getType && out.getType() === 'Polygon') {
          const feat = createPenFeature({
            id: ids.join(','),   // store all contributing IDs
            type: 'pen',
            label,
            color,
            penSize,           // stylistic; not critical here
            geometry: out.getCoordinates()
          });
          if (feat) vectorSourceRef.current.addFeature(feat);
        } else if (out.getType && out.getType() === 'MultiPolygon') {
          out.getCoordinates().forEach(polyCoords => {
            const feat = createPenFeature({
              id: ids.join(','),   // store all contributing IDs
              type: 'pen',
              label,
              color,
              penSize,
              geometry: polyCoords
            });
            if (feat) vectorSourceRef.current.addFeature(feat);
          });
        } else {
          // Unexpected type: fallback, skip
        }
      } catch (e) {
        console.error('Failed to write/feature pen geometry for label', label, e);
      }
    });
  }, [annotations]); // re-run whenever annotations change

  // ---------- Styling + feature creation ----------
  const createPenStyle = (label, color) => new Style({
    stroke: new Stroke({ color: '#000000', width: 2 }),
    fill: new Fill({ color: color + '80' }),
    text: label ? new Text({
      text: label,
      fill: new Fill({ color: '#000000' }),
      stroke: new Stroke({ color: '#ffffff', width: 3 }),
      font: 'bold 16px Arial',
      offsetY: -15,
      overflow: true
    }) : undefined
  });

  const createBBoxStyle = (label, color) => new Style({
    stroke: new Stroke({ color: '#000000', width: 2 }),
    fill: new Fill({ color: color + 'AA' }),
    text: label ? new Text({
      text: label,
      fill: new Fill({ color: '#000000' }),
      stroke: new Stroke({ color: '#ffffff', width: 3 }),
      font: 'bold 16px Arial',
      offsetY: -15,
      overflow: true
    }) : undefined
  });

  const createPointStyle = (label, color) => new Style({
    image: new Circle({
      radius: 6,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: '#000000', width: 2 })
    }),
    text: label ? new Text({
      text: label,
      fill: new Fill({ color: '#000000' }),
      stroke: new Stroke({ color: '#ffffff', width: 3 }),
      font: 'bold 12px Arial',
      offsetY: -20,
      overflow: true
    }) : undefined
  });

  const createBBoxFeature = (annotation) => {
    // Reverse the linear ring to ensure CCW winding for OL/JSTS correctness
    const reversedGeometry = annotation.geometry[0].slice().reverse();
    const feature = new Feature({
      geometry: new Polygon([reversedGeometry]),
      id: annotation.id,
      type: 'bbox',
      label: annotation.label,
      color: annotation.color
    });
    feature.setStyle(createBBoxStyle(annotation.label, annotation.color));
    return feature;
  };

  // IMPORTANT: preserve holes (do NOT wrap as new Polygon([coords]))
  const createPenFeature = (annotation) => {
    try {
      const coords = annotation.geometry;
      const isMulti =
        Array.isArray(coords) &&
        Array.isArray(coords[0]) &&
        Array.isArray(coords[0][0]) &&
        Array.isArray(coords[0][0][0]) &&
        Array.isArray(coords[0][0][0][0]);

      const geometry = isMulti ? new MultiPolygon(coords) : new Polygon(coords);

      const feature = new Feature({
        geometry,
        id: annotation.id,
        type: 'pen',
        label: annotation.label,
        color: annotation.color,
        penSize: annotation.penSize
      });

      feature.setStyle(createPenStyle(annotation.label, annotation.color));
      return feature;
    } catch (error) {
      console.error('Error creating pen feature:', error);
      return null;
    }
  };

  const createPointFeature = (annotation) => {
    const feature = new Feature({
      geometry: new Point(annotation.geometry),
      id: annotation.id,
      type: 'point',
      label: annotation.label,
      color: annotation.color
    });
    feature.setStyle(createPointStyle(annotation.label, annotation.color));
    return feature;
  };

  // ---------- Expose undo/clear to parent ----------
  React.useImperativeHandle(mapRef, () => ({
    clearAnnotations: () => {
      vectorSourceRef.current.clear();
      setFeatureHistory([]);
    },
    undoLastAnnotation: () => {
      if (featureHistory.length > 0) {
        vectorSourceRef.current.clear();
        featureHistory.forEach(feat => vectorSourceRef.current.addFeature(feat));
        if (selectInteraction) {
          selectInteraction.getFeatures().clear();
        }
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
    },
    activateSelect: setupSelectTool,
    activateLassoSelect: setupLassoSelect,
    getSelectedFeatures: () =>
      selectInteraction ? selectInteraction.getFeatures().getArray() : [],
    deleteSelectedFeatures: () => {
      if (!selectInteraction) return;
      // snapshot before delete
      setFeatureHistory([...vectorSourceRef.current.getFeatures()]);

      const selected = selectInteraction.getFeatures().getArray();

      // Remove from source and update annotations
      selected.forEach(f => {
        const featureType = f.get('type');

        if (featureType === 'pen') {
          // For pen features, find which individual annotations contributed to the selected area
          const selectedGeom = jstsParser.read(f.getGeometry());

          if (onAnnotationsChange) {
            onAnnotationsChange(prev => prev.filter(a => {
              if (a.type !== 'pen') return true;
              try {
                const annGeom = jstsParser.read(toOlPolygonOrMulti(a.geometry));
                // Keep annotation if it doesn't intersect the selected geometry
                return !selectedGeom.intersects(annGeom);
              } catch (e) {
                console.error('Geometry intersection check failed:', e);
                return true;
              }
            }));
          }
        } else {
          // For bbox and point features, delete by ID as before
          const ids = (f.get('id') || '').split(',').filter(Boolean);
          if (onAnnotationsChange && ids.length > 0) {
            onAnnotationsChange(prev => prev.filter(a => !ids.includes(String(a.id))));
          }
        }

        vectorSourceRef.current.removeFeature(f);
      });

      selectInteraction.getFeatures().clear();
    },
    applyLabelToSelected: (newLabel, color) => {
      if (!selectInteraction) return;
      // snapshot before relabel
      setFeatureHistory([...vectorSourceRef.current.getFeatures()]);

      const selected = selectInteraction.getFeatures().getArray();

      selected.forEach(f => {
        const selectedGeom = jstsParser.read(f.getGeometry());

        if (onAnnotationsChange) {
          onAnnotationsChange(prev =>
            prev.map(a => {
              try {
                let annGeom;

                if (a.type === 'pen') {
                  annGeom = jstsParser.read(toOlPolygonOrMulti(a.geometry));
                } else if (a.type === 'bbox') {
                  annGeom = jstsParser.read(new Polygon(a.geometry));
                } else if (a.type === 'point') {
                  annGeom = jstsParser.read(new Point(a.geometry));
                } else {
                  return a; // skip unknown types
                }

                // Relabel only annotations whose geometry overlaps the selected feature
                if (selectedGeom.intersects(annGeom)) {
                  return { ...a, label: newLabel, color };
                }
              } catch (err) {
                console.error('Relabel geometry check failed:', err);
              }
              return a;
            })
          );
        }

        // Update OL feature style for immediate feedback
        f.set('label', newLabel);
        f.set('color', color);

        if (f.get('type') === 'bbox') {
          f.setStyle(createBBoxStyle(newLabel, color));
        } else if (f.get('type') === 'point') {
          f.setStyle(createPointStyle(newLabel, color));
        } else {
          f.setStyle(createPenStyle(newLabel, color));
        }
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
        cursor: crosshairActive ? 'none'
          : (drawingMode === 'pen' ? 'crosshair'
            : drawingMode === 'bbox' ? 'crosshair' : 'default'),
        overflow: 'hidden',
      }}
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
    </Box>
  );
};

export default MapView;
