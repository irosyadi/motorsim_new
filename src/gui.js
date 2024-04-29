
import Chart, { plugins, scales } from 'chart.js/auto'
import {Pane} from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';

const instance = {};

var speedChart = {};
var tempChart = {};
var currentChart = {};
var voltageChart = {};
var vibrationChart = {};
var infoPane = {};

const connectionStatus = document.createElement("div");
connectionStatus.id = 'connection-status';
connectionStatus.classList.add('status');

const motorStatus = document.createElement("div");
motorStatus.id = 'motor-status';
motorStatus.classList.add('status')

var recentInformation = {}

function Init(statistic, config, datasets, callbacks) {
  const statusBarContainer = document.createElement("div")
  const controlPaneContainer = document.createElement("div")
  const infoPaneContainer = document.createElement("div")
  const graphPaneContainer = document.createElement("div")
  const statusBar = document.createElement("div")
  const titleBar = document.createElement("div")
  const viewport = document.createElement("div")

  controlPaneContainer.style = "position:absolute;right:0;padding:15px;max-width:25%;width:auto;"
  infoPaneContainer.style = "position:absolute;left:0;padding:15px;max-width:25%;width:auto;"
  graphPaneContainer.style = "position:absolute;bottom:0;width:100%;overflow:auto;clear:both;"
  viewport.style = "width:100%;height:100%;position:absolute;"

  document.body.prepend(infoPaneContainer)
  document.body.prepend(statusBarContainer)
  document.body.prepend(controlPaneContainer)
  document.body.prepend(graphPaneContainer)

  titleBar.appendChild(document.createTextNode("ELECTRIC MOTOR MONITORING"));
  connectionStatus.appendChild(document.createTextNode("UNKNOWN"));
  motorStatus.appendChild(document.createTextNode("UNKNOWN"));

  statusBarContainer.id = 'status-bar-container'
  statusBar.id = 'status-bar'
  titleBar.id = 'title-bar'
  statusBar.appendChild(titleBar)
  statusBar.appendChild(connectionStatus)
  statusBar.appendChild(motorStatus)

  statusBarContainer.appendChild(statusBar)

  recentInformation = datasets[datasets.length - 1]

  const controlPane = new Pane({
    container: controlPaneContainer,
    title: 'Controls',
  });

  infoPane = new Pane({
    container: infoPaneContainer,
    title: 'Informations'
  });

  const graphPane = new Pane({
    container: graphPaneContainer,
    title: 'Graphs'
  });

  graphPane.registerPlugin(EssentialsPlugin);

  setupControl(controlPane, statistic, config, callbacks)

  setupInformation(infoPane, recentInformation)

  const graphTabs = graphPane.addTab({
    pages: [
      {title: 'Speed'},
      {title: 'Temperature'},
      {title: 'Current'},
      {title: 'Voltage'},
      {title: 'Vibration'},
    ]
  })

  const speedChartContainer = document.createElement("canvas")
  const temperatureChartContainer = document.createElement("canvas")
  const currentChartContainer = document.createElement("canvas")
  const voltageChartContainer = document.createElement("canvas")
  const vibrationChartContainer = document.createElement("canvas")

  speedChartContainer.id = 'tp-chart-speed'
  temperatureChartContainer.id = 'tp-chart-temp'
  currentChartContainer.id = 'tp-chart-current'
  voltageChartContainer.id = 'tp-chart-voltage'
  vibrationChartContainer.id = 'tp-chart-vibration'

  speedChartContainer.classList.add('tp-chart')
  temperatureChartContainer.classList.add('tp-chart')
  currentChartContainer.classList.add('tp-chart')
  voltageChartContainer.classList.add('tp-chart')
  vibrationChartContainer.classList.add('tp-chart')

  speedChartContainer.style = "max-height:200px;padding:5px 10px;"
  temperatureChartContainer.style = "max-height:200px;padding:5px 10px;"
  currentChartContainer.style = "max-height:200px;padding:5px 10px;"
  voltageChartContainer.style = "max-height:200px;padding:5px 10px;"
  vibrationChartContainer.style = "max-height:200px;padding:5px 10px;"

  // const lineGraphFilter = {
  //   showCurrentLine: 'all',
  //   showVoltageLine: 'all',
  //   showVibrationLine: 'all',
  // }

  // const line = ['u', 'v', 'w']
  // const position = ['x', 'y', 'z']

  // graphTabs.pages[2].addBinding(lineGraphFilter, 'showCurrentLine', {
  //   view: 'radiogrid',
  //   groupName: 'scale',
  //   size: [3, 1],
  //   cells: (x, y) => ({
  //     title: `${line[y * 3 + x]}`.toUpperCase(),
  //     value: line[y * 3 + x],
  //   }),
  //   label: 'Filter Line',
  // })

  // graphTabs.pages[3].addBinding(lineGraphFilter, 'showVoltageLine', {
  //   view: 'radiogrid',
  //   groupName: 'scale',
  //   size: [3, 1],
  //   cells: (x, y) => ({
  //     title: `${line[y * 3 + x]}`.toUpperCase(),
  //     value: line[y * 3 + x],
  //   }),
  //   label: 'Filter Line',
  // })

  // graphTabs.pages[4].addBinding(lineGraphFilter, 'showVibrationLine', {
  //   view: 'radiogrid',
  //   groupName: 'scale',
  //   size: [3, 1],
  //   cells: (x, y) => ({
  //     title: `${position[y * 3 + x]}`.toUpperCase(),
  //     value: position[y * 3 + x],
  //   }),
  //   label: 'Filter Direction',
  // })


  const chartConfig = {
    animation: false,
    elements: {
      point:{
        radius: 0
      }
    },
  }

  graphTabs.pages[0].controller.view.containerElement.style = 'height:200px;'
  graphTabs.pages[0].controller.view.containerElement.appendChild(speedChartContainer)

  speedChart = new Chart(speedChartContainer, {
    type: 'line',
    data: {
      labels: datasets.map(row => timeline(row.timestamp)),
      datasets: [
        {
          label: 'Revolution Per Minute',
          data: datasets.map(row => row.speed),
          borderColor: '#FFFFFF',
          backgroundColor: '#FFFFFF',
        }
      ]
    },
    options: chartConfig,
  })

  graphTabs.pages[1].controller.view.containerElement.style = 'height:200px;'
  graphTabs.pages[1].controller.view.containerElement.appendChild(temperatureChartContainer)

  tempChart = new Chart(temperatureChartContainer, {
    type: 'line',
    data: {
      labels: datasets.map(row => timeline(row.timestamp)),
      datasets: [
        {
          label: 'Temperature',
          data: datasets.map(row => row.temp),
          borderColor: '#FFFFFF',
          backgroundColor: '#FFFFFF',
        }
      ]
    },
    options: chartConfig,
  })

  graphTabs.pages[2].controller.view.containerElement.style = 'height:200px;'
  graphTabs.pages[2].controller.view.containerElement.appendChild(currentChartContainer)

  currentChart = new Chart(currentChartContainer, {
    type: 'line',
    data: {
      labels: datasets.map(row => timeline(row.timestamp)),
      datasets: [
        {
          label: 'Current U',
          data: datasets.map(row => row.currentU),
          borderColor: '#FF3128',
          backgroundColor: '#FF3128',
        },
        {
          label: 'Current V',
          data: datasets.map(row => row.currentV),
          borderColor: '#FFFC17',
          backgroundColor: '#FFFC17',
        },
        {
          label: 'Current W',
          data: datasets.map(row => row.currentW),
          borderColor: '#53B7FF',
          backgroundColor: '#53B7FF',
        },
      ]
    },
    options: chartConfig,
  })

  graphTabs.pages[3].controller.view.containerElement.style = 'height:200px;'
  graphTabs.pages[3].controller.view.containerElement.appendChild(voltageChartContainer)

  voltageChart = new Chart(voltageChartContainer, {
    type: 'line',
    data: {
      labels: datasets.map(row => timeline(row.timestamp)),
      datasets: [
        {
          label: 'Voltage U',
          data: datasets.map(row => row.voltageU),
          borderColor: '#FF3128',
          backgroundColor: '#FF3128',
        },
        {
          label: 'Voltage V',
          data: datasets.map(row => row.voltageV),
          borderColor: '#FFFC17',
          backgroundColor: '#FFFC17',
        },
        {
          label: 'Voltage W',
          data: datasets.map(row => row.voltageW),
          borderColor: '#53B7FF',
          backgroundColor: '#53B7FF',
        },
      ]
    },
    options: chartConfig,
  })

  graphTabs.pages[4].controller.view.containerElement.style = 'height:200px;'
  graphTabs.pages[4].controller.view.containerElement.appendChild(vibrationChartContainer)

  vibrationChart = new Chart(vibrationChartContainer, {
    type: 'line',
    data: {
      labels: datasets.map(row => timeline(row.timestamp)),
      datasets: [
        {
          label: 'Vibration X',
          data: datasets.map(row => row.vibrationX),
          borderColor: '#FF3128',
          backgroundColor: '#FF3128',
        },
        {
          label: 'Vibration Y',
          data: datasets.map(row => row.vibrationY),
          borderColor: '#FFFC17',
          backgroundColor: '#FFFC17',
        },
        {
          label: 'Vibration Z',
          data: datasets.map(row => row.vibrationZ),
          borderColor: '#53B7FF',
          backgroundColor: '#53B7FF',
        },
      ]
    },
    options: chartConfig,
  })

  speedChartContainer.setAttribute('height', 200)
  temperatureChartContainer.setAttribute('height', 200)
  currentChartContainer.setAttribute('height', 200)
  voltageChartContainer.setAttribute('height', 200)
  vibrationChartContainer.setAttribute('height', 200)

  speedChart.update()
  tempChart.update()
  currentChart.update()
  voltageChart.update()
  vibrationChart.update()
}

function SyncGraph(datasets) {
  speedChart.data.labels = datasets.map(row => timeline(row.timestamp))
  speedChart.data.datasets.forEach((dataset) => {
    dataset.data = datasets.map(row => row.speed)
  })

  tempChart.data.labels = datasets.map(row => timeline(row.timestamp))
  tempChart.data.datasets.forEach((dataset) => {
    dataset.data = datasets.map(row => row.temp)
  })

  currentChart.data.labels = datasets.map(row => timeline(row.timestamp))
  currentChart.data.datasets.forEach((dataset, index) => {
    switch(index) {
      case 0:
        dataset.data = datasets.map(row => row.currentU)
        break;
      case 1:
        dataset.data = datasets.map(row => row.currentV)
        break;
      case 2:
        dataset.data = datasets.map(row => row.currentW)
        break;
    }
  })

  voltageChart.data.labels = datasets.map(row => timeline(row.timestamp))
  voltageChart.data.datasets.forEach((dataset, index) => {
    switch(index) {
      case 0:
        dataset.data = datasets.map(row => row.voltageU)
        break;
      case 1:
        dataset.data = datasets.map(row => row.voltageV)
        break;
      case 2:
        dataset.data = datasets.map(row => row.voltageW)
        break;
    }
  })

  vibrationChart.data.labels = datasets.map(row => timeline(row.timestamp))
  vibrationChart.data.datasets.forEach((dataset, index) => {
    switch(index) {
      case 0:
        dataset.data = datasets.map(row => row.vibrationX)
        break;
      case 1:
        dataset.data = datasets.map(row => row.vibrationY)
        break;
      case 2:
        dataset.data = datasets.map(row => row.vibrationZ)
        break;
    }
  })

  speedChart.update()
  tempChart.update()
  currentChart.update()
  voltageChart.update()
  vibrationChart.update()
}

function SyncInformation(datasets) {
  let latestFrame = datasets[datasets.length - 1]

  recentInformation.timestamp = latestFrame.timestamp
  recentInformation.status = latestFrame.status
  recentInformation.speed = latestFrame.speed
  recentInformation.temp = latestFrame.temp
  recentInformation.currentU = latestFrame.currentU
  recentInformation.currentV = latestFrame.currentV
  recentInformation.currentW = latestFrame.currentW
  recentInformation.voltageU = latestFrame.voltageU
  recentInformation.voltageV = latestFrame.voltageV
  recentInformation.voltageW = latestFrame.voltageW
  recentInformation.vibrationX = latestFrame.vibrationX
  recentInformation.vibrationY = latestFrame.vibrationY
  recentInformation.vibrationZ = latestFrame.vibrationZ

  infoPane.refresh()
}

function setupControl(controlPane, stats, config, callbacks) {
  controlPane.addBinding(stats, "networkLatency", {
    label: "Network Latency",
    readonly: true,
    format: (v) => v + ' ms',
  })

  controlPane.addBinding(stats, "renderingLatency", {
    label: "Rendering Latency",
    readonly: true,
    format: (v) => v + ' ms',
  })

  controlPane.addBinding(stats, "sensorInterval", {
    label: "Sensor Interval",
    readonly: true,
    format: (v) => v + ' ms',
  })

  controlPane.addBinding(config, "interval", {
    label: 'Update Interval',
    step: 100,
    format: (v) => v === 0 ? 'ASAP' : (v === 1000 ? '1 s' : v + ' ms'),
    min: 100,
    max: 1000,
    // disabled: config.adaptiveInterval,
  }).on('change', (ev) => {
    if (callbacks.interval !== null) {
      callbacks.interval(ev.value)
    }
  })

  // controlPane.addBinding(config, "adaptiveInterval", {
  //   label: "Adaptive Interval",
  // }).on('change', (ev) => {
  //   if (callbacks.adaptiveInterval !== null) {
  //     callbacks.adaptiveInterval(ev.value)
  //     controlPane.children[3].disabled = config.adaptiveInterval
  //   }
  // })

  const viewControlFolder = controlPane.addFolder({
    title: "View"
  })

  const viewControlTabs = viewControlFolder.addTab({
    pages: [
      {title: 'Motor'},
      {title: 'Current'},
    ]
  })

  viewControlTabs.pages[0].addBinding(config, "statorOpacity", {
    label: "Stator Opacity",
    step: 1,
    min: 0,
    max: 100,
  }).on('change', (ev) => {
    if (callbacks.statorOpacity !== null) {
      callbacks.statorOpacity(ev.value)
    }
  })

  viewControlTabs.pages[0].addBinding(config, "rotorOpacity", {
    label: "Rotor Opacity",
    step: 1,
    min: 0,
    max: 100,
  }).on('change', (ev) => {
    if (callbacks.rotorOpacity !== null) {
      callbacks.rotorOpacity(ev.value)
    }
  })

  viewControlTabs.pages[0].addBinding(config, "wireOpacity", {
    label: "Wire Opacity",
    step: 1,
    min: 0,
    max: 100,
  }).on('change', (ev) => {
    if (callbacks.wireOpacity !== null) {
      callbacks.wireOpacity(ev.value)
    }
  })

  viewControlTabs.pages[0].addBinding(config, "inputOpacity", {
    label: "Input Opacity",
    step: 1,
    min: 0,
    max: 100,
  }).on('change', (ev) => {
    if (callbacks.inputOpacity !== null) {
      callbacks.inputOpacity(ev.value)
    }
  })

  viewControlTabs.pages[0].addBinding(config, "motorShowEndBell", {
    label: "Show End Bell",
  }).on('change', (ev) => {
    if (callbacks.motorShowEndBell !== null) {
      callbacks.motorShowEndBell(ev.value)
    }
  })

  viewControlTabs.pages[0].addBinding(config, "motorShowFrame", {
    label: "Show Frame",
  }).on('change', (ev) => {
    if (callbacks.motorShowFrame !== null) {
      callbacks.motorShowFrame(ev.value)
    }
  })


  viewControlTabs.pages[0].addBinding(config, "motorShowFanCover", {
    label: "Show Fan Cover",
  }).on('change', (ev) => {
    if (callbacks.motorShowFanCover !== null) {
      callbacks.motorShowFanCover(ev.value)
    }
  })


  viewControlTabs.pages[0].addBinding(config, "motorShowFan", {
    label: "Show Fan",
  }).on('change', (ev) => {
    if (callbacks.motorShowFan !== null) {
      callbacks.motorShowFan(ev.value)
    }
  })


  viewControlTabs.pages[0].addBinding(config, "motorShowShaft", {
    label: "Show Shaft",
  }).on('change', (ev) => {
    if (callbacks.motorShowShaft !== null) {
      callbacks.motorShowShaft(ev.value)
    }
  })


  viewControlTabs.pages[0].addBinding(config, "motorShowBearing", {
    label: "Show Bearing",
  }).on('change', (ev) => {
    if (callbacks.motorShowBearing !== null) {
      callbacks.motorShowBearing(ev.value)
    }
  })

  viewControlTabs.pages[1].addBinding(config, "currentParticleColor", {
    label: "Particle Color",
  }).on('change', (ev) => {
    if (callbacks.currentParticleColor !== null) {
      callbacks.currentParticleColor(ev.value)
    }
  })

  viewControlTabs.pages[1].addBinding(config, "currentParticleDensity", {
    label: "Particle Density",
    step: 1,
    min: 1,
    max: 300,
  }).on('change', (ev) => {
    if (callbacks.currentParticleDensity !== null) {
      callbacks.currentParticleDensity(ev.value)
    }
  })

  viewControlTabs.pages[1].addBinding(config, "currentHideULine", {
    label: "Hide U Line",
  }).on('change', (ev) => {
    if (callbacks.currentHideULine !== null) {
      callbacks.currentHideULine(ev.value)
    }
  })

  viewControlTabs.pages[1].addBinding(config, "currentHideVLine", {
    label: "Hide V Line",
  }).on('change', (ev) => {
    if (callbacks.currentHideVLine !== null) {
      callbacks.currentHideVLine(ev.value)
    }
  })

  viewControlTabs.pages[1].addBinding(config, "currentHideWLine", {
    label: "Hide W Line",
  }).on('change', (ev) => {
    if (callbacks.currentHideWLine !== null) {
      callbacks.currentHideWLine(ev.value)
    }
  })

  viewControlTabs.pages[1].addBinding(config, "currentParticleScale", {
    label: "Particle Scale",
    min: 0.002,
    max: 0.015,
  }).on('change', (ev) => {
    if (callbacks.currentParticleScale !== null) {
      callbacks.currentParticleScale(ev.value)
    }
  })

  viewControlTabs.pages[1].addBinding(config, "currentParticleOpacity", {
    label: "Particle Opacity",
    min: 0,
    max: 1,
  }).on('change', (ev) => {
    if (callbacks.currentParticleOpacity !== null) {
      callbacks.currentParticleOpacity(ev.value)
    }
  })
}

function setupInformation(infoPane, recentInformation) {
  infoPane.addBinding(recentInformation, "status", {
    label: "Status",
    readonly: true,
    format: (v) => v + ' RPM',
  })
  infoPane.addBinding(recentInformation, "speed", {
    label: "Speed",
    readonly: true,
    format: (v) => v + ' RPM',
  })
  infoPane.addBinding(recentInformation, "temp", {
    label: "Temperature",
    readonly: true,
    format: (v) => v + ' °C',
  })

  const infoCurrentFolder = infoPane.addFolder({
    title: "Current"
  })

  infoCurrentFolder.addBinding(recentInformation, "currentU", {
    label: "U Line",
    readonly: true,
    format: (v) => v + ' A',
  })
  infoCurrentFolder.addBinding(recentInformation, "currentV", {
    label: "V Line",
    readonly: true,
    format: (v) => v + ' A',
  })
  infoCurrentFolder.addBinding(recentInformation, "currentW", {
    label: "W Line",
    readonly: true,
    format: (v) => v + ' A',
  })

  const infoVoltageFolder = infoPane.addFolder({
    title: "Voltage"
  })

  infoVoltageFolder.addBinding(recentInformation, "voltageU", {
    label: "U Line",
    readonly: true,
    format: (v) => v + ' V',
  })
  infoVoltageFolder.addBinding(recentInformation, "voltageV", {
    label: "V Line",
    readonly: true,
    format: (v) => v + ' V',
  })
  infoVoltageFolder.addBinding(recentInformation, "voltageW", {
    label: "W Line",
    readonly: true,
    format: (v) => v + ' V',
  })

  const infoVibrationFolder = infoPane.addFolder({
    title: "Vibration"
  })

  infoVibrationFolder.addBinding(recentInformation, "vibrationX", {
    label: "X",
    readonly: true,
    format: (v) => v + ' g',
  })
  infoVibrationFolder.addBinding(recentInformation, "vibrationY", {
    label: "Y",
    readonly: true,
    format: (v) => v + ' g',
  })
  infoVibrationFolder.addBinding(recentInformation, "vibrationZ", {
    label: "Z",
    readonly: true,
    format: (v) => v + ' g',
  })
}

function SetConnect() {
  connectionStatus.className = 'status';
  connectionStatus.classList.add('busy');
  connectionStatus.innerText = "CONNECTING";
}

function SetReconnect() {
  connectionStatus.className = 'status';
  connectionStatus.classList.add('busy');
  connectionStatus.innerText = "RECONNECTING";
}

function SetListening() {
  connectionStatus.className = 'status';
  connectionStatus.classList.add('success');
  connectionStatus.innerText = "CONNECTED";
}

function SetRunning() {
  connectionStatus.className = 'status';
  connectionStatus.classList.add('success');
  connectionStatus.innerText = "STREAMING";
}

function SetDisconnect() {
  connectionStatus.className = 'status';
  connectionStatus.classList.add('error');
  connectionStatus.innerText = "DISCONNECTED";
}

function SetNormal() {
  motorStatus.className = 'status';
  motorStatus.classList.add('success');
  motorStatus.innerText = "NORMAL";
}

function SetError(str) {
  motorStatus.className = 'status';
  motorStatus.classList.add('error');
  motorStatus.innerText = str;
}

function SetUnknown() {
  motorStatus.className = 'status';
  motorStatus.innerText = 'UNKNOWN';
}

function timeline(dateStr) {
  let timestamp = new Date(dateStr)

  return `${('0'+timestamp.getHours()).slice(-2)}`
    +`:${('0'+timestamp.getMinutes()).slice(-2)}`
    +`:${('0'+timestamp.getSeconds()).slice(-2)}`
}

export default {
  Init,
  SyncGraph,
  SyncInformation,
  SetConnect,
  SetReconnect,
  SetListening,
  SetRunning,
  SetDisconnect,
  SetNormal,
  SetError,
  SetUnknown,
}