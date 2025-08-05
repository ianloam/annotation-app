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
export default function AnnotationApp() {
  // Main state
  const [drawingMode, setDrawingMode] = useState('pen');
  const [penMode, setPenMode] = useState('add');
  const [penSize, setPenSize] = useState(10);
  const [autoLabel, setAutoLabel] = useState(true);
  const [currentLabel, setCurrentLabel] = useState('Label A');
  const [labels, setLabels] = useState(['Label A', 'Label B', 'Label C']);
  const [crosshairActive, setCrosshairActive] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [optionsMenuAnchor, setOptionsMenuAnchor] = useState(null);

  // Refs
  const mapRef = useRef(null);
  const crosshairRef = useRef(null);
  const fileInputRef = useRef(null);

  const updateCrosshair = (e) => {
    if (!crosshairActive || !crosshairRef.current || !mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
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

  const handleAnnotationAdd = (annotation) => {
    setAnnotations(prev => [...prev, annotation]);
  };

  const handleDeleteSelected = () => {
    setAnnotations([]);
  };

  const handleUndo = () => {
    setAnnotations(prev => prev.slice(0, -1));
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
          autoLabel={autoLabel}
          setAutoLabel={setAutoLabel}
          labels={labels}
        />
        <Box component="main" sx={{ flexGrow: 1, position: 'relative' }}>
          <MapView
            mapRef={mapRef}
            crosshairActive={crosshairActive}
            crosshairRef={crosshairRef}
            updateCrosshair={updateCrosshair}
            uploadedImage={uploadedImage}
            annotations={annotations}
            onAnnotationAdd={handleAnnotationAdd}
            currentLabel={currentLabel}
            penSize={penSize}
            drawingMode={drawingMode}
            penMode={penMode}
          />
        </Box>
      </Box>
    </ThemeProvider>
  );
}
