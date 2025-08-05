//THIS IS THE REFERENCE FOR THE SIDEBAR AND UI
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Drawer,
  Typography,
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Slider,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Select,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
} from '@mui/material';
import {
  Edit as EditIcon,
  CropFree as BoundingBoxIcon,
  Place as PointIcon,
  SelectAll as LassoIcon,
  Delete as DeleteIcon,
  Undo as UndoIcon,
  MergeType as MergeIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  PanTool as MoveIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Flag as FlagIcon,
  Note as NoteIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const theme = createTheme({
  palette: {
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
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [startPoint, setStartPoint] = useState(null);

  const handleMouseDown = (e) => {
    if (drawingMode === 'pen') {
      setIsDrawing(true);
      const rect = mapRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setCurrentPath([{ x, y }]);
    } else if (drawingMode === 'bbox') {
      const rect = mapRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setStartPoint({ x, y });
      setIsDrawing(true);
    }
  };

  const handleMouseMove = (e) => {
    updateCrosshair(e);

    if (isDrawing && drawingMode === 'pen') {
      const rect = mapRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setCurrentPath(prev => [...prev, { x, y }]);
    }
  };

  const handleMouseUp = (e) => {
    if (isDrawing) {
      if (drawingMode === 'pen' && currentPath.length > 1) {
        const annotation = {
          id: Date.now(),
          type: 'pen',
          path: currentPath,
          label: currentLabel,
          penSize,
          mode: penMode,
          color: getColorFromText(currentLabel)
        };
        onAnnotationAdd(annotation);
      } else if (drawingMode === 'bbox' && startPoint) {
        const rect = mapRef.current.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;

        const annotation = {
          id: Date.now(),
          type: 'bbox',
          x: Math.min(startPoint.x, endX),
          y: Math.min(startPoint.y, endY),
          width: Math.abs(endX - startPoint.x),
          height: Math.abs(endY - startPoint.y),
          label: currentLabel,
          color: getColorFromText(currentLabel)
        };
        onAnnotationAdd(annotation);
      }

      setIsDrawing(false);
      setCurrentPath([]);
      setStartPoint(null);
    }
  };

  const getColorFromText = (text) => {
    if (!text) return '#000000';
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = '#' + ('000000' + (hash & 0xFFFFFF).toString(16)).slice(-6);
    return color;
  };

  const renderAnnotations = () => {
    return annotations.map(annotation => {
      if (annotation.type === 'pen') {
        const pathData = annotation.path.map((point, index) =>
          `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
        ).join(' ');

        return (
          <g key={annotation.id}>
            <path
              d={pathData}
              stroke={annotation.color}
              strokeWidth={annotation.penSize}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {annotation.label && (
              <text
                x={annotation.path[0]?.x}
                y={annotation.path[0]?.y - 10}
                fill={annotation.color}
                fontSize="14"
                fontWeight="bold"
              >
                {annotation.label}
              </text>
            )}
          </g>
        );
      } else if (annotation.type === 'bbox') {
        return (
          <g key={annotation.id}>
            <rect
              x={annotation.x}
              y={annotation.y}
              width={annotation.width}
              height={annotation.height}
              fill={annotation.color + '33'}
              stroke={annotation.color}
              strokeWidth="2"
            />
            {annotation.label && (
              <text
                x={annotation.x + 5}
                y={annotation.y - 5}
                fill={annotation.color}
                fontSize="14"
                fontWeight="bold"
              >
                {annotation.label}
              </text>
            )}
          </g>
        );
      }
      return null;
    });
  };

  const renderCurrentDrawing = () => {
    if (drawingMode === 'pen' && isDrawing && currentPath.length > 1) {
      const pathData = currentPath.map((point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
      ).join(' ');

      return (
        <path
          d={pathData}
          stroke={getColorFromText(currentLabel)}
          strokeWidth={penSize}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
      );
    } else if (drawingMode === 'bbox' && isDrawing && startPoint) {
      const rect = mapRef.current?.getBoundingClientRect();
      if (!rect) return null;

      // This would need mouse position tracking for live preview
      return null;
    }
    return null;
  };

  return (
    <Box
      ref={mapRef}
      sx={{
        width: '100%',
        height: '100%',
        backgroundColor: '#f5f5f5',
        minHeight: '100vh',
        position: 'relative',
        cursor: drawingMode === 'pen' ? 'crosshair' : drawingMode === 'bbox' ? 'crosshair' : 'default',
        overflow: 'hidden',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Background Image */}
      {uploadedImage && (
        <img
          src={uploadedImage}
          alt="Annotation target"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* SVG Overlay for Annotations */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        {renderAnnotations()}
        {renderCurrentDrawing()}
      </svg>

      {/* Crosshair overlay */}
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

      {/* Instructions overlay */}
      {!uploadedImage && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#666',
          }}
        >
          <Typography variant="h6">Upload an image to start annotating</Typography>
          <Typography variant="body2">Click "Upload Image" in the sidebar</Typography>
        </Box>
      )}
    </Box>
  );
};

export default function AnnotationApp() {
  // Main state
  const [drawingMode, setDrawingMode] = useState('pen');
  const [penMode, setPenMode] = useState('add');
  const [penSize, setPenSize] = useState(10);
  const [autoLabel, setAutoLabel] = useState(true);
  const [currentLabel, setCurrentLabel] = useState('Label A');
  const [labels, setLabels] = useState(['Label A', 'Label B', 'Label C']);
  const [selectedObjects, setSelectedObjects] = useState(0);
  const [crosshairActive, setCrosshairActive] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [annotations, setAnnotations] = useState([]);

  // Refs
  const mapRef = useRef();
  const crosshairRef = useRef(null);
  const fileInputRef = useRef(null);

  // Menu anchor states
  const [labelMenuAnchor, setLabelMenuAnchor] = useState(null);
  const [optionsMenuAnchor, setOptionsMenuAnchor] = useState(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);

  const updateCrosshair = (e) => {
    if (!crosshairActive || !crosshairRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    crosshairRef.current.style.left = `${x}px`;
    crosshairRef.current.style.top = `${y}px`;
  };

  const handleDrawingModeChange = (event, newMode) => {
    if (newMode !== null) {
      setDrawingMode(newMode);
      // Enable crosshair for bbox mode
      setCrosshairActive(newMode === 'bbox');
    }
  };

  const handlePenModeChange = (event, newMode) => {
    if (newMode !== null) {
      setPenMode(newMode);
    }
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadedImage(url);
    }
  };

  const handleAnnotationAdd = (annotation) => {
    setAnnotations(prev => [...prev, annotation]);
  };

  const handleDeleteSelected = () => {
    // For now, just clear all annotations
    setAnnotations([]);
    setSelectedObjects(0);
  };

  const handleUndo = () => {
    setAnnotations(prev => prev.slice(0, -1));
  };

  const handleExport = (format) => {
    if (format === 'json') {
      const dataStr = JSON.stringify(annotations, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const exportFileDefaultName = 'annotations.json';
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    }
    setExportMenuAnchor(null);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh' }}>
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/*"
          onChange={handleImageUpload}
        />

        {/* Sidebar */}
        <Drawer
          variant="permanent"
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: SIDEBAR_WIDTH,
              boxSizing: 'border-box',
            },
          }}
        >
          <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Annotation Tools
            </Typography>

            {/* General Options */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1" fontWeight={500}>
                  General Options
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <ButtonGroup orientation="vertical" fullWidth variant="outlined" size="small" sx={{ mb: 2 }}>
                  <Button
                    startIcon={<UploadIcon />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload Image
                  </Button>
                  <Button startIcon={<UploadIcon />}>
                    Upload Annotations
                  </Button>
                  <Button
                    startIcon={<DownloadIcon />}
                    onClick={(e) => setExportMenuAnchor(e.currentTarget)}
                  >
                    Export
                  </Button>
                  <Button
                    startIcon={<SettingsIcon />}
                    onClick={(e) => setOptionsMenuAnchor(e.currentTarget)}
                  >
                    Settings
                  </Button>
                </ButtonGroup>

                <Menu
                  anchorEl={exportMenuAnchor}
                  open={Boolean(exportMenuAnchor)}
                  onClose={() => setExportMenuAnchor(null)}
                >
                  <MenuItem onClick={() => handleExport('json')}>Export JSON</MenuItem>
                  <MenuItem onClick={() => handleExport('images')}>Export Images</MenuItem>
                  <MenuItem onClick={() => handleExport('report')}>Export Report</MenuItem>
                </Menu>

                <Menu
                  anchorEl={optionsMenuAnchor}
                  open={Boolean(optionsMenuAnchor)}
                  onClose={() => setOptionsMenuAnchor(null)}
                >
                  <MenuItem>Switch Sidebar Side</MenuItem>
                  <MenuItem>Time Tracking Settings</MenuItem>
                </Menu>

                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Add notes about this image..."
                  variant="outlined"
                  size="small"
                  sx={{ mt: 1 }}
                />
              </AccordionDetails>
            </Accordion>

            {/* Object Drawing Modes */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1" fontWeight={500}>
                  Drawing Modes
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <ToggleButtonGroup
                  value={drawingMode}
                  exclusive
                  onChange={handleDrawingModeChange}
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                >
                  <ToggleButton value="pen">
                    <EditIcon fontSize="small" />
                    <Typography variant="body2" sx={{ ml: 1 }}>Pen</Typography>
                  </ToggleButton>
                  <ToggleButton value="bbox">
                    <BoundingBoxIcon fontSize="small" />
                    <Typography variant="body2" sx={{ ml: 1 }}>BBox</Typography>
                  </ToggleButton>
                  <ToggleButton value="point">
                    <PointIcon fontSize="small" />
                    <Typography variant="body2" sx={{ ml: 1 }}>Point</Typography>
                  </ToggleButton>
                </ToggleButtonGroup>

                {/* Pen Mode Options */}
                {drawingMode === 'pen' && (
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                      Pen Mode
                    </Typography>
                    <ToggleButtonGroup
                      value={penMode}
                      exclusive
                      onChange={handlePenModeChange}
                      size="small"
                      orientation="vertical"
                      fullWidth
                      sx={{ mb: 2 }}
                    >
                      <ToggleButton value="add">
                        <AddIcon fontSize="small" />
                        <Typography variant="body2" sx={{ ml: 1 }}>Add/Select</Typography>
                      </ToggleButton>
                      <ToggleButton value="subtract">
                        <RemoveIcon fontSize="small" />
                        <Typography variant="body2" sx={{ ml: 1 }}>Subtract</Typography>
                      </ToggleButton>
                      <ToggleButton value="move">
                        <MoveIcon fontSize="small" />
                        <Typography variant="body2" sx={{ ml: 1 }}>Move</Typography>
                      </ToggleButton>
                    </ToggleButtonGroup>

                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                      Pen Size: {penSize}px
                    </Typography>
                    <Slider
                      value={penSize}
                      onChange={(e, value) => setPenSize(value)}
                      min={1}
                      max={50}
                      size="small"
                      sx={{ mb: 2 }}
                    />
                  </Box>
                )}

                {/* Bounding Box Options */}
                {drawingMode === 'bbox' && (
                  <Box>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={crosshairActive}
                          onChange={(e) => setCrosshairActive(e.target.checked)}
                        />
                      }
                      label="Show Crosshairs"
                      sx={{ mb: 1 }}
                    />
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>

            {/* Object Administration */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1" fontWeight={500}>
                  Object Edits
                  {annotations.length > 0 && (
                    <Badge badgeContent={annotations.length} color="primary" sx={{ ml: 1 }} />
                  )}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <ButtonGroup orientation="vertical" fullWidth variant="outlined" size="small">
                  <Button startIcon={<LassoIcon />}>
                    Lasso Select
                  </Button>
                  <Button
                    startIcon={<DeleteIcon />}
                    color="error"
                    onClick={handleDeleteSelected}
                  >
                    Delete All
                  </Button>
                  <Button
                    startIcon={<UndoIcon />}
                    onClick={handleUndo}
                    disabled={annotations.length === 0}
                  >
                    Undo
                  </Button>
                  <Button startIcon={<MergeIcon />}>
                    Merge Selected
                  </Button>
                </ButtonGroup>
              </AccordionDetails>
            </Accordion>

            {/* Object Metadata */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1" fontWeight={500}>
                  Labels & Metadata
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    Apply Label
                  </Typography>
                  <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                    <InputLabel>Current Label</InputLabel>
                    <Select
                      value={currentLabel}
                      label="Current Label"
                      onChange={(e) => setCurrentLabel(e.target.value)}
                    >
                      {labels.map((label) => (
                        <MenuItem key={label} value={label}>
                          {label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoLabel}
                        onChange={(e) => setAutoLabel(e.target.checked)}
                        size="small"
                      />
                    }
                    label="Auto-label new objects"
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    Current Labels
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {labels.map((label, index) => (
                      <Chip
                        key={label}
                        label={label}
                        size="small"
                        variant={currentLabel === label ? "filled" : "outlined"}
                        onClick={() => setCurrentLabel(label)}
                        style={{ backgroundColor: currentLabel === label ? `hsl(${index * 60}, 70%, 80%)` : 'transparent' }}
                      />
                    ))}
                  </Box>
                </Box>

                <ButtonGroup orientation="vertical" fullWidth variant="outlined" size="small">
                  <Button startIcon={<FlagIcon />}>
                    Flag Object
                  </Button>
                  <Button startIcon={<NoteIcon />}>
                    Add Text Note
                  </Button>
                </ButtonGroup>
              </AccordionDetails>
            </Accordion>
          </Box>
        </Drawer>

        {/* Main Content Area */}
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
