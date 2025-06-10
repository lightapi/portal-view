import React from 'react';
import { withTheme } from '@mui/styles'

import {
  Grid, Card, CardHeader, CardContent, Typography, FormControl, FormControlLabel, FormLabel, RadioGroup, Radio,
  TextField, InputLabel, Select, MenuItem, IconButton, Tooltip
} from '@mui/material';
import { DateTimePicker } from '@mui/lab';
import AdapterMoment from '@mui/lab/AdapterMoment';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import RefreshIcon from '@mui/icons-material/Refresh';

import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'

// Todo: Put in a library for reuse
const getCookieValue = (name) => document?.cookie?.split('; ')?.find(a => a.startsWith(`${name}=`))?.split('=')?.[1] || undefined;

class LogViewer extends React.Component {
  constructor(props) {
    super(props);

    this.logUrl = '/services/logger/content';

    this.node = props?.location?.state?.data?.node || {};
    // console.log('LogViewer ctor: props=', props)

    this.logLevels = ['All','ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
    this.timePresets = [
      {label: '1m', seconds: 60},
      {label: '5m', seconds: 300},
      {label: '10m', seconds: 600},
      {label: '30m', seconds: 1800},
      {label: '1h', seconds: 3600},
      {label: '1d', seconds: 86400},
      {label: '1w', seconds: 604800},
    ];

    this.state = {
      logNames: [],
      logName: 'All',
      logLevel: 'All',
      from: Date.now(),
      to: Date.now(),
      preset: null,
      logData: [],
      autoRefresh: true, // For future switch option
    };

    this.defaultColDef = {
      flex: 1,
//      minWidth: 80,
      editable: false,
      sortable: true,
      resizable: true,
    };

    this.columnDefs = [
      {
        field: 'timestamp',
        headerName: 'Time',
        cellStyle: { textAlign: 'left' },
        minWidth: 200,
      },
      {
        field: 'logName',
        headerName: 'Log Name',
        cellStyle: { textAlign: 'left' },
      },
      {
        field: 'level',
        headerName: 'Log Level',
        cellStyle: { textAlign: 'left' },
      },
      {
        field: 'logMessage',
        headerName: 'Log Message',
        cellStyle: { textAlign: 'left' },
        minWidth: 400,
      },
      {
        field: 'thread',
        headerName: 'Thread',
        cellStyle: { textAlign: 'left' },
      },
      {
        field: 'correlationId',
        headerName: 'Correlation ID',
        cellStyle: { textAlign: 'left' },
      },
      {
        field: 'serviceId',
        headerName: 'Service ID',
        cellStyle: { textAlign: 'left' },
      },
      {
        field: 'class',
        headerName: 'Class',
        cellStyle: { textAlign: 'left' },
      },
      {
        field: 'lineNumber',
        headerName: 'Line #',
        cellStyle: { textAlign: 'left' },
      },
      {
        field: 'method',
        headerName: 'Method',
        cellStyle: { textAlign: 'left' },
      },
    ];
  };

  componentDidMount = async () => {
    try {
      const { protocol, address, port } = this.node;
      const response = await fetch(`/services/logger?protocol=${protocol}&address=${address}&port=${port}`, {
        method: 'GET',
        headers: {
          'X-CSRF-TOKEN': getCookieValue('csrf'),
        },
      });
      // console.log('result=', response)
      if (!response.ok) throw new Error(response);
      const logNames = await response.json();
      // console.log('logNames=', logNames)
      this.setState({logNames});
    } catch (error) {
      this.setState({logNames: []});
      // Todo: Invoke a snackbar
    }
  };

  onChangeLogName = event => {
    this.setState({logName: event.target.value});
  };

  onChangeLogLevel = event => {
    this.setState({logLevel: event.target.value});
  };

  onChangeFrom = moment => {
    this.setState({from: moment.valueOf(), preset: null});
  };

  onChangeTo = moment => {
    this.setState({to: moment.valueOf(), preset: null});
  };

  onChangePreset = event => {
    const seconds = event.target.value;
    this.setState({preset: seconds});
  };

  onClickRefresh = async () => {
    const { protocol, address, port } = this.node;
    const startTime = this.state.preset ? Date.now() - 1000 * this.state.preset : this.state.from;
    const endTime = this.state.preset ? Date.now() : this.state.to;

    // console.log('cookie, CSRF=', document.cookie, getCookieValue('csrf'));
    try {
      const response = await fetch(this.logUrl, {
        method: 'POST',
        headers: {
          'X-CSRF-TOKEN': getCookieValue('csrf'),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          protocol,
          address,
          port,
          startTime: startTime.toString(),
          endTime: endTime.toString(),
          loggerName: this.state.logName === 'All' ? undefined : this.state.logName,
          loggerLevel: this.state.logLevel === 'All' ? 'TRACE' : this.state.logLevel,
        })
      });
      if (!response.ok) throw new Error(response);
      const data = await response.json();

      const logData = Object.entries(data).reduce((a, [k, v]) => a.concat((v.logs || []).map(l => ({ ...l, logName: k }))), []);
      this.setState({logData});
      // console.log('logData=', logData)

    } catch (error) {
      // console.log('Refresh: error=', error)
      this.setState({logData: []});
      // Todo: Invoke a snackbar
    }
  };

  render = (props) => {
    console.log('LogViewer render: props=', this.props)
    return (
      <LocalizationProvider dateAdapter={AdapterMoment}>
        <Grid container spacing={2}>
          <Grid item xs={4} />
          <Grid item xs={4}>
          <Card elevation={2} style={{backgroundColor: this.props.theme?.palette?.tertiary?.light, width: '100%'}}>
            <CardHeader title={<Typography variant='h6' style={{textAlign: 'center'}}>{this.node?.apiName}</Typography>} />
          </Card>
          </Grid>
          <Grid item xs={4} />
          <Grid item xs={12}>
            <Card elevation={2} style={{backgroundColor: this.props.theme?.palette?.tertiary?.light, width: '100%'}}>
              <CardHeader title={<Typography variant='h6'>Filters</Typography>} />
              <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={2}>
                <FormControl fullWidth>
                    <InputLabel id='log-name-label'>Log Name</InputLabel>
                    <Select
                      labelId='log-name-label-id'
                      id='log-name-id'
                      value={this.state.logName}
                      onChange={this.onChangeLogName}
                      label='Log Name'
                    >
                      <MenuItem key={0} value={'All'}>All</MenuItem>  
                      {this.state.logNames.map((l, i) => (
                        <MenuItem key={i+1} value={l.name}>{l.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={1}>
                  <FormControl fullWidth>
                    <InputLabel id='log-level-label'>Log Level</InputLabel>
                    <Select
                      labelId='log-level-label-id'
                      id='log-level-id'
                      value={this.state.logLevel}
                      onChange={this.onChangeLogLevel}
                      label='Log Level'
                    >
                      {this.logLevels.map((logLevel, i) => (
                        <MenuItem key={i} value={logLevel}>{logLevel}</MenuItem>  
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={2}>
                  <DateTimePicker
                    label='From'
                    value={this.state.from}
                    onChange={this.onChangeFrom}
                    renderInput={(params) => <TextField {...params} />}
                    showTodayButton={true}
                  />
                </Grid>
                <Grid item xs={2}>
                  <DateTimePicker
                    label='To'
                    value={this.state.to}
                    onChange={this.onChangeTo}
                    renderInput={(params) => <TextField {...params} />}
                  />
                </Grid>

                <Grid item xs={4}>
                  <Card elevation={1} style={{backgroundColor: this.props.theme?.palette?.tertiary?.light, width: '100%', borderRadius: 10}}>
                  <FormControl component="fieldset">
                    <Grid container spacing={1} border={0} style={{width: '500px'}}>
                      <Grid item xs={1}>
                        <FormLabel component='legend' style={{paddingLeft: 3, paddingTop: 14}}><Typography variant='body2' style={{fontWeight: 600}}>Last</Typography></FormLabel>
                      </Grid>
                      <Grid item xs={11}>
                        <RadioGroup
                          row
                          aria-label="data-source-type"
                          name="controlled-radio-buttons-group"
                          value={this.state.preset}
                          onChange={this.onChangePreset}
                          sx={{
                            paddingTop: 1,
                            paddingBottom: 1,
                          }}
                        >
                          {this.timePresets.map((p, i) => (
                            <FormControlLabel
                              key={i}
                              value={p.seconds}
                              control={<Radio
                                sx={{
                                  '& .MuiSvgIcon-root': {
                                    fontSize: 14,
                                  },
                                  padding: .5,
                                }}
                                  />}
                              label={<Typography variant='body2'>{p.label}</Typography>}
                              labelPlacement='top'
                            />
                          ))}
                        </RadioGroup>
                      </Grid>
                    </Grid>
                  </FormControl>
                  </Card>
                </Grid>

                <Grid item xs={1}>
                  <Tooltip title="Refresh">
                    <IconButton
                      onClick={this.onClickRefresh}
                    >
                      <RefreshIcon sx={{color: 'green', fontSize: 40}} />
                    </IconButton>
                  </Tooltip>
                </Grid>
              </Grid>

              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card elevation={2} style={{backgroundColor: this.props.theme?.palette?.tertiary?.light, width: '100%'}}>
              <CardHeader title={<Typography variant='h6'>Logs</Typography>} />
              <CardContent>
                <div
                  id="myGrid"
                  style={{
                    height: '500px',
                    width: '100%',
                  }}
                  className="ag-theme-alpine"
                >
                  <AgGridReact
                    columnDefs={this.columnDefs}
                    defaultColDef={this.defaultColDef}
                    onGridReady={this.onGridReady}
                    rowData={this.state.logData}
                    tooltipShowDelay={0}
                    enableCellTextSelection={true}
                  />
                </div>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </LocalizationProvider>
    );
  }
}

export default withTheme(LogViewer);
