import React, { useState, useRef } from 'react';
import { Box, ThemeProvider, CssBaseline } from '@mui/material';
import Sidebar from './Sidebar';
import MapView from './MapView';
import { createTheme } from '@mui/material/styles';

const theme = createTheme({palette: {
    mode: 'light',
    primary: {
      main: '#2c2c2c',
    },
    background: {
      default: '#fafafa',
      paper: '#ffffff',
    },
    text: {
      primary: '#1a1a1a',
      secondary: '#666666',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#fafafa',
          borderRight: '1px solid #e0e0e0',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
  },
});

const SIDEBAR_WIDTH = 320;

// Define colors for labels
const labelColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd'];

export default function AnnotationApp() {
  // Main state
  const [drawingMode, setDrawingMode] = useState('pen');
  const [penMode, setPenMode] = useState('move');
  const [penSize, setPenSize] = useState(10);

  const [currentLabel, setCurrentLabel] = useState('');
  const [labels, setLabels] = useState(['Label A', 'Label B', 'Label C']);
  const [crosshairActive, setCrosshairActive] = useState(false);
  const mainBoxRef = useRef(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [optionsMenuAnchor, setOptionsMenuAnchor] = useState(null);

  // Refs
  const mapRef = useRef(null);
  const crosshairRef = useRef(null);
  const fileInputRef = useRef(null);

  const updateCrosshair = (e) => {
    if (!crosshairActive || !crosshairRef.current || !mainBoxRef.current) return;

    const rect = mainBoxRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    crosshairRef.current.style.left = `${x}px`;
    crosshairRef.current.style.top = `${y}px`;
  };

  const handleDrawingModeChange = (event, newMode) => {
    if (newMode !== null) {
      setDrawingMode(newMode);
      setCrosshairActive(newMode === 'bbox');
    }
  };

  const handlePenModeChange = (event, newMode) => {
    if (newMode !== null) setPenMode(newMode);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) setUploadedImage(URL.createObjectURL(file));
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        setUploadedImage(URL.createObjectURL(file));
      }
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleAnnotationAdd = (annotation) => {
    console.log('App - adding annotation:', annotation);
    setAnnotations(prev => {
      const newAnnotations = [...prev, annotation];
      console.log('App - new annotations state:', newAnnotations);
      return newAnnotations;
    });
  };

  const handleDeleteSelected = () => {
    setAnnotations([]);
  };

  const handleUndo = () => {
    setAnnotations(prev => prev.slice(0, -1));
  };

  const handleDeleteLabel = (label) => {
    if (window.confirm(`Are you sure you want to delete label "${label}" and all its annotations?`)) {
      setLabels(prev => prev.filter(l => l !== label));
      setAnnotations(prev => prev.filter(a => a.label !== label));
      if (currentLabel === label) setCurrentLabel('');
    }
  };

  const handleExport = (format) => {
    if (format === 'json') {
      const dataStr = JSON.stringify(annotations, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', 'annotations.json');
      linkElement.click();
    }
    setExportMenuAnchor(null);
  };
    return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh' }}>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/*"
          onChange={handleImageUpload}
        />

        <Sidebar
          SIDEBAR_WIDTH={SIDEBAR_WIDTH}
          fileInputRef={fileInputRef}
          mapRef={mapRef}
          exportMenuAnchor={exportMenuAnchor}
          setExportMenuAnchor={setExportMenuAnchor}
          optionsMenuAnchor={optionsMenuAnchor}
          setOptionsMenuAnchor={setOptionsMenuAnchor}
          handleExport={handleExport}
          drawingMode={drawingMode}
          handleDrawingModeChange={handleDrawingModeChange}
          penMode={penMode}
          handlePenModeChange={handlePenModeChange}
          penSize={penSize}
          setPenSize={setPenSize}
          crosshairActive={crosshairActive}
          setCrosshairActive={setCrosshairActive}
          annotations={annotations}
          handleDeleteSelected={handleDeleteSelected}
          handleUndo={handleUndo}
          currentLabel={currentLabel}
          setCurrentLabel={setCurrentLabel}
          labels={labels}
          setLabels={setLabels}
          labelColors={labelColors}
          handleDeleteLabel={handleDeleteLabel}
        />
        <Box ref={mainBoxRef} component="main" sx={{ flexGrow: 1, position: 'relative', cursor: crosshairActive ? 'none' : undefined }} onMouseMove={updateCrosshair} onDrop={handleDrop} onDragOver={handleDragOver}>
          <MapView
            mapRef={mapRef}
            crosshairActive={crosshairActive}
            uploadedImage={uploadedImage}
            annotations={annotations}
            onAnnotationAdd={handleAnnotationAdd}
            onAnnotationsChange={setAnnotations}
            currentLabel={currentLabel}
            penSize={penSize}
            drawingMode={drawingMode}
            penMode={penMode}
            labels={labels}
            labelColors={labelColors}
          />
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
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '-100vh',
                  left: '0',
                  width: '2px',
                  height: '200vh',
                  backgroundColor: 'black',
                }}
              />
            </div>
          )}
        </Box>
      </Box>
    </ThemeProvider>
  );
}
