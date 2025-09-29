import React from 'react';
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
  Slider,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  Autocomplete,
} from '@mui/material';
import {
  Edit as EditIcon,
  CropFree as BoundingBoxIcon,
  Place as PointIcon,
  SelectAll as LassoIcon,
  Delete as DeleteIcon,
  Undo as UndoIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  PanTool as MoveIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Flag as FlagIcon,
  Note as NoteIcon,
  ExpandMore as ExpandMoreIcon,
  NearMe as NearMeIcon,
  DeleteSweep as DeleteSweepIcon,
  Label as LabelIcon,
} from '@mui/icons-material';

export default function Sidebar({
  SIDEBAR_WIDTH,
  fileInputRef,
  mapRef,
  exportMenuAnchor,
  setExportMenuAnchor,
  optionsMenuAnchor,
  setOptionsMenuAnchor,
  handleExport,
  drawingMode,
  handleDrawingModeChange,
  penMode,
  handlePenModeChange,
  penSize,
  setPenSize,
  crosshairActive,
  setCrosshairActive,
  annotations,
  handleDeleteSelected,
  handleUndo,
  currentLabel,
  setCurrentLabel,
  labels,
  setLabels,
  labelColors,
  handleDeleteLabel
}) {
  return (
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
                <Button startIcon={<NearMeIcon />} onClick={() => mapRef.current?.activateSelect()}>
                  Single Select
                </Button>
                <Button startIcon={<LassoIcon />} onClick={() => mapRef.current?.activateLassoSelect()}>
                  Lasso Select
                </Button>
                <Button
                  startIcon={<DeleteIcon />}
                  color="error"
                  onClick={handleDeleteSelected}
                >
                  Delete All
                </Button>
                <Button startIcon={<DeleteSweepIcon />} onClick={() => mapRef.current?.deleteSelectedFeatures()}>
                  Delete Selected
                </Button>
                 <Button
                   startIcon={<UndoIcon />}
                   onClick={handleUndo}
                   disabled={annotations.length === 0}
                 >
                   Undo
                 </Button>
             </ButtonGroup>
          </AccordionDetails>
        </Accordion>

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
               <Autocomplete
                 freeSolo
                 options={labels}
                 value={currentLabel}
                 onChange={(event, newValue) => {
                   if (newValue && newValue !== '' && !labels.includes(newValue)) {
                     setLabels(prev => [...prev, newValue]);
                   }
                   setCurrentLabel(newValue || '');
                 }}
                 renderInput={(params) => <TextField {...params} label="Current Label" size="small" />}
                 sx={{ mb: 1 }}
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
                    onClick={() => setCurrentLabel(currentLabel === label ? '' : label)}
                    onDelete={() => handleDeleteLabel(label)}
                    style={{ backgroundColor: currentLabel === label ? labelColors[index % labelColors.length] : 'transparent' }}
                  />
                ))}
              </Box>
            </Box>

             <ButtonGroup orientation="vertical" fullWidth variant="outlined" size="small">
                <Button startIcon={<LabelIcon />} onClick={() => {
                  if (currentLabel) {
                    const index = labels.indexOf(currentLabel);
                    const color = index === -1 ? '#000000' : labelColors[index % labelColors.length];
                    mapRef.current?.applyLabelToSelected(currentLabel, color);
                  }
                }}>
                  Apply Label to Selected
                </Button>
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
  );
}
