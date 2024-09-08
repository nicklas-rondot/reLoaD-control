let timelineJson = []

    const moduleList = document.getElementById('module-list')
    const timelineRows = document.getElementById('timeline-rows')
    const moduleSelector = document.getElementById('module-selector')
    let flask;

    getTimelineData()

    function displayModuleSelector(){
        moduleSelector.style.display = 'block'
    }

    function hideModuleSelector(){
        moduleSelector.style.display = 'none'
    }

    function openCodeEditor(){
        console.log('show code editor overlay')
        fetch('/code_editor_overlay')
        .then(response => response.text())
        .then(data => {
          // Append the overlay content to the body and create editor instance
          document.body.insertAdjacentHTML('beforeend', data);
          flask = new CodeFlask('#code-editor', { 
            language: 'js',
            lineNumbers: true,
          });
          flask.updateCode(JSON.stringify(timelineJson, null, 2));

        })
        .catch(error => console.error('Error fetching overlay content:', error));
    }

    function closeCodeEditor(){
      document.getElementById("code-editor-overlay").remove()
    }

    function saveCodeEditor(){
      timelineJson = JSON.parse(flask.getCode());
      closeCodeEditor();
      clearTimeline();
      buildTimeline();
      timelineDataToLocalstorage();
    }

    function clearTimeline(){
      moduleList.innerHTML = '';
      timelineRows.innerHTML = '';
    }

    function buildTimeline(){
      for(module of timelineJson){
        const moduleElement = document.getElementById(`module-${module.name}`)
        if (moduleElement === null) addModuleElement(module.name);
        changeModuleConnectionState(module.name, module.connected)
        for(action of module.actions){
          const actionElement = document.getElementById(`timeline-action-${action.id}`)
          if (actionElement === null) addActionElement(module.name, action);
        }
      }

      showScreens();
    }

    function showScreens(){

      const screenValues = new Set();

      function processActions(actions) {
        actions.forEach(action => {
          if (action.methods && action.methods.read && action.methods.read.screen) {
            screenValues.add(action.methods.read.screen);
          }
        });
      }

      timelineJson.forEach(entry => {
        if (entry.actions) {
          processActions(entry.actions);
        }
      });

      console.log(screenValues);
      for (let i=1; i<=3; i++) {
        let screenElement = document.getElementById(`screen${i}`);
        if (screenValues.has(String(i))){
          screenElement.style.display = 'block';
        }
        else{
          screenElement.style.display = 'none';
        }

      }

    }

    function addModule(module){
        let moduleJson = {
          'name': module,
          'connected': false,
          'actions': []
        }
        timelineJson.push(moduleJson)

        timelineDataToLocalstorage()

        addModuleElement(module)
    }

    function addModuleElement(module){
        // Create the li element
        let liElement = document.createElement("li");
        liElement.classList.add('module')
        liElement.id = `module-${module}`

        // Create the paragraph element and set its content
        let pElement = document.createElement("p");
        pElement.textContent = module;
        pElement.classList.add('module-title', 'text-sm')

        // Create the "Connect" button element
        let buttonElement = document.createElement("button");
        buttonElement.textContent = "Connect";
        buttonElement.classList.add('connect-button', 'text-xs', 'text-gray-600')
        buttonElement.id = `connect-button-${module}`
        buttonElement.addEventListener('click', function() {
          connect(`${module}`);
        });

        // Append the paragraph and button elements to the li element
        liElement.appendChild(pElement);
        liElement.appendChild(buttonElement);
        moduleList.appendChild(liElement);

        let rowElement = document.createElement("li");
        rowElement.id = `timeline-row-${module}`
        rowElement.classList.add('timeline-row')
        rowElement.addEventListener('click', function() {
          showAddActionOverlay(`${module}`);
        });

        timelineRows.appendChild(rowElement)
    }

    function convertTimeToSeconds(timeString) {
      const [minutes, seconds] = timeString.split(":").map(Number);
      return minutes * 60 + seconds;
    }

    function addActionElement(module, action){
      console.log(action)
      const startSeconds = convertTimeToSeconds(action['startTime']);
      const endSeconds = convertTimeToSeconds(action['endTime']);
      const widthSeconds = endSeconds - startSeconds;

      const actionElement = document.createElement("div");
      actionElement.classList.add('timeline-action');
      actionElement.id = `timeline-action-${action.id}`

      actionElement.style.left = `${startSeconds * 10}px`;
      actionElement.style.width = `${widthSeconds * 10}px`;

      const timeElement = document.createElement("p");
      timeElement.classList.add('timeline-action-times');
      timeElement.textContent = `${action['startTime']} - ${action['endTime']}`

      const deleteButton = document.createElement("button");
      deleteButton.classList.add('timeline-action-delete')
      deleteButton.onclick = () => {deleteAction(module, action.id)}
      const deleteIcon = document.createElement("i")
      deleteIcon.classList.add('material-icons')
      deleteIcon.style.fontSize = "14px"
      deleteIcon.textContent = 'close'
      deleteButton.appendChild(deleteIcon)

      actionElement.appendChild(timeElement)
      actionElement.appendChild(deleteButton)


      if(action['methods']['write']){
        const method = document.createElement("div");
        method.classList.add('timeline-action-method');
        const title = document.createElement("p");
        title.classList.add('timeline-action-title');
        title.textContent = action['methods']['write']['function'];
        method.appendChild(title);
        
        const parameterStr = action['methods']['write']['startData'];
        const parameterPairs = parameterStr.split(/\s+/);

        for (let i = 0; i < parameterPairs.length; i += 2) {
          const parameterName = parameterPairs[i];
          const parameterValue = parameterPairs[i + 1];

          const badge = document.createElement("span");
          badge.classList.add("timeline-action-badge");
          badge.textContent = `${parameterName} ${parameterValue}`;
          method.appendChild(badge);
        }
        actionElement.appendChild(method);
      }

      if(action['methods']['read']){
        const method = document.createElement("div");
        method.classList.add('timeline-action-method');
        const title = document.createElement("p");
        title.classList.add('timeline-action-title', 'text-sm');
        title.textContent = action['methods']['read']['function'];
        method.appendChild(title);
        
        const parameterStr = action['methods']['read']['format'];
        const parameters = parameterStr.split(/\s+/);

        for (let i = 0; i < parameters.length; i += 1) {
          const parameterName = parameters[i];

          const badge = document.createElement("span");
          badge.classList.add("timeline-action-badge");

          badge.textContent = `${parameterName}`;
          method.appendChild(badge);
        }
        actionElement.appendChild(method);
      }
      const moduleRow = document.getElementById(`timeline-row-${module}`);
      moduleRow.appendChild(actionElement)
      
    }

    function showAddActionOverlay(module){
        try{
        document.getElementById('action-overlay').remove()
        }
        catch{
        }

        console.log('show add action overlay')
        fetch(`/show_add_action_overlay?module=${module}`)
        .then(response => response.text())
        .then(data => {
        // Append the overlay content to the body
        document.body.insertAdjacentHTML('beforeend', data);
        })
        .catch(error => console.error('Error fetching overlay content:', error));
    }

    function closeAddActionOverlay(){
      document.getElementById('action-overlay').remove()
    }

    function addFunctionVariables(method){
      let select = document.getElementById(`function-${method}-select`)
      let functionName = select.options[select.selectedIndex].text
      try{
        document.getElementById(`function-${method}`).variables.remove()
      }
      catch{}
      console.log('add function variables')
        fetch(`/add_function_variables?function=${functionName}`)
        .then(response => response.text())
        .then(data => {
        // Append the overlay content to the body
        document.getElementById(`function-${method}`).insertAdjacentHTML('beforeend', data);
        })
        .catch(error => console.error('Error fetching overlay content:', error));
    }

    function isValildTimeFormat(timeString) {
      // Regular expression to match the MM:SS format
      const timeRegex = /^\d{1,2}:\d{2}$/;

      if (!timeRegex.test(timeString)) {
        return false;
      }

      // Splitting the timeString into minutes and seconds
      const [minutes, seconds] = timeString.split(':');

      // Converting minutes and seconds to integers
      const parsedMinutes = parseInt(minutes, 10);
      const parsedSeconds = parseInt(seconds, 10);

      // Checking if minutes and seconds are within valid ranges
      if (parsedMinutes < 0 || parsedMinutes > 59 || parsedSeconds < 0 || parsedSeconds > 59) {
        return false;
      }

      return true;
    }


    function addAction(module){
      const startTime = document.getElementById('start-time').value
      const endTime = document.getElementById('end-time').value

      if (!isValildTimeFormat(startTime)){
        document.getElementById('start-time').style.outline = "1px solid red";
        return;
      }
      else{
        document.getElementById('start-time').style.outline = "none";
      }

      if (!isValildTimeFormat(endTime)){
        document.getElementById('end-time').style.outline = "1px solid red";
        return;
      }
      else{
        document.getElementById('end-time').style.outline = "none";
      }

      const id = Date.now().toString(36) + Math.floor(Math.pow(10, 12) + Math.random() * 9*Math.pow(10, 12)).toString(36)

      let actionJson = {
        'id': id,
        'startTime': startTime,
        'endTime': endTime,
        'StartTimeoutId': null,
        'StopTimeoutId': null,
        'methods': {}
      }

      let writeSelect = document.getElementById(`function-write-select`)
      let writeFunctionName = writeSelect.options[writeSelect.selectedIndex].text

      let readSelect = document.getElementById(`function-read-select`)
      let readFunctionName = readSelect.options[readSelect.selectedIndex].text
      console.log(readFunctionName)

      if(writeFunctionName == "-- select an option --" && readFunctionName == "-- select an option --"){
        writeSelect.style.outline = "1px solid red";
        readSelect.style.outline = "1px solid red";
        return;
      }
      else{
        writeSelect.style.outline = "none";
        readSelect.style.outline = "none";
      }

      let writeVariableStr = ""

      let i = 1
      let index_exists = true
      while(index_exists){
        try{
          let variable_name = document.getElementById(`variable-write-name-${i}`).textContent
          let variable_value = document.getElementById(`variable-write-value-${i}`).value
          if(!variable_value){
            document.getElementById(`variable-write-value-${i}`).style.outline = "1px solid red";
            return;
          }
          else{
            document.getElementById(`variable-write-value-${i}`).style.outline = "none";
          }
          if(writeVariableStr != ""){
            writeVariableStr += " "
          }
          writeVariableStr += `${variable_name} ${variable_value}`
        }
        catch{
          index_exists = false
        }
        i += 1
      }

      if(writeVariableStr != ""){
        let writeJson = {
          'function': writeFunctionName,
          'startData': writeVariableStr,
          'stopData': writeVariableStr.replace(/\d+/g, '0'),
        }
        actionJson['methods']['write'] = writeJson
      }


      let readVariableStr = ""
      let selectedScreen

      i = 1
      index_exists = true
      try{
          let screenSelect = document.getElementById(`function-read-select-screen`)
          selectedScreen = screenSelect.options[screenSelect.selectedIndex].value
          if(selectedScreen == "-- select a screen --"){
            screenSelect.style.outline = "1px solid red";
            return;
          }
          else{
            screenSelect.style.outline = "none";
          }
      }
      catch{
        index_exists = false
      }

      while(index_exists){
        try{
          let variable_name = document.getElementById(`variable-read-name-${i}`).textContent
          if(readVariableStr != ""){
            readVariableStr += " "
          }
          readVariableStr += `${variable_name}`
        }
        catch{
          index_exists = false
        }
        i += 1
      }


      if(readVariableStr != ""){
        let readJson = {
          'function': readFunctionName,
          'format': readVariableStr,
          'screen': selectedScreen,
        }
        actionJson['methods']['read'] = readJson
      }

      let moduleObj = timelineJson.find(moduleObj => moduleObj.name === module)


      moduleObj['actions'].push(actionJson)
      console.log(timelineJson)
      addActionElement(module, actionJson)
      closeAddActionOverlay()
      showScreens()
      timelineDataToLocalstorage()
    }

    function deleteAction(module, actionId){
      let moduleObjIndex = timelineJson.findIndex(moduleObj => moduleObj.name === module)
      console.log(timelineJson[moduleObjIndex])

      if(timelineJson[moduleObjIndex]['actions']){
        let actionObjIndex = timelineJson[moduleObjIndex]['actions'].findIndex(actionObj => actionObj.id === actionId);

        if (actionObjIndex !== -1) {
          timelineJson[moduleObjIndex]['actions'].splice(actionObjIndex, 1);
        }

        document.getElementById(`timeline-action-${actionId}`).remove()
      }
      else{
        console.log(`couldn't remove action with ID ${actionId}`)
      }
      console.log(timelineJson)
      timelineDataToLocalstorage()

    }

    function changeModuleConnectionState(module, state){
      let connectButton = document.getElementById(`connect-button-${module}`)
      let moduleObj = timelineJson.find(moduleObj => moduleObj.name === module)

      if(state == "connected"){
        moduleObj.connected = true
        connectButton.classList.add('connected')
        connectButton.textContent = "Connected"
      }
      else if(state == "disconnected"){
        moduleObj.connected = false
        connectButton.classList.add('disconnected')
        connectButton.textContent = "Connect"
      }
      console.log(timelineJson)

    }


        // --------
    // Timeline
    const timelineJson1 = [
      {
        'name': 'spectroscope',
        'connected': false,
        'actions': [
          {
            'startTime': '00:00',
            'endTime': '00:50',
            'StartTimeoutId': null,
            'StopTimeoutId': null,
            'methods': {
              'read': {
                'format': 'fluorescence <fluorescence_value>',
                'screen': '1',
              }
            }
          }

        ]
      },
      {
        'name': 'motor',
        'connected': false,
        'actions': [
          {
            'startTime': '00:00',
            'endTime': '00:30',
            'StartTimeoutId': null,
            'StopTimeoutId': null,
            'methods': {
              'write': {
                'startData': 'rpm 1000',
                'stopData': 'rpm 0',
              }
            }
          },
          {
            'startTime': '00:30',
            'endTime': '00:45',
            'StartTimeoutId': null,
            'StopTimeoutId': null,
            'methods': {
              'write': {
                'startData': 'rpm 2000',
                'stopData': 'rpm 0',
              }
            }
          },
        ]
      },
      {
        'name': 'eload',
        'connected': false,
        'actions': [
          {
            'startTime': '00:00',
            'endTime': '00:10',
            'StartTimeoutId': null,
            'StopTimeoutId': null,
            'methods': {
              'write': {
                'startData': 'denaturation 95, extension 72, annealing 55',
                'stopData': 'denaturation 0, extension 0, annealing 0',
              },
              'read': {
                'format': 'denaturation <denaturation_value>, extension <extension_value>, annealing <annealing_value>',
                'screen': '2',
              }
            }

          }
        ]
      }
    ]

    const screens = [];


    function blRead(device, format, screen) {
      console.log(`Reading data from ${device} with format: ${format}`);

      const oldScreenIndex = screens.findIndex(old_screen => old_screen.id === screen)
      if(oldScreenIndex !== -1){
        console.log(`Killing old chart on screen ${screen}`);
        screens[oldScreenIndex].chartInstance.destroy()
        screens.splice(oldScreenIndex, 1)
      }

      screens.push(
        {
          id: screen,
          display: device,
          data: {},
          chartInstance: null,
          disabled: false,
          format: format,
          readBuffer: "",
        },
      )
      const currentTime = new Date().getTime();
      screen = screens.find(screen => screen.display === device) || null;
      let variables = format.split(/\s+/)
      for(variable of variables){
        screen.data[variable] = [{ x: currentTime, y: 0 }]
      }
      chart = createChart(screen, format)
      screen.chartInstance = chart;
      console.log(screens)
      
    }

    function blStopRead(device, format) {
      console.log(`Stop reading data from ${device} with format: ${format}`);
      screen = screens.find(screen => screen.display === device) || null;
      disableChart(screen);
    }

    var timelineStartTime = new Date();

    // Main function to trigger actions based on timeline JSON
    function runTimeline() {

      timelineStartTime = new Date()

      timelineJson.forEach((entry) => {
        let device = entry.name;

        entry.actions.forEach((action) => {

          let startTime = parseTime(action.startTime);
          let endTime = parseTime(action.endTime);

          if (action.methods.hasOwnProperty('write')) {
            let startData = action.methods.write.startData;
            let stopData = action.methods.write.stopData;

            // Trigger bleSend at startTime with startData
            action.StartTimeoutId = setTimeout(() => {
              blSend(device, startData);
            }, startTime);

            let next_action_index = entry.actions.findIndex(next_action => next_action.startTime === action.endTime)

            if(next_action_index == -1){
              // Trigger bleSend at endTime with stopData
              action.StopTimeoutId = setTimeout(() => {
                blSend(device, stopData);
              }, endTime);
            }
          }

          if (action.methods.hasOwnProperty('read')) {
            let format = action.methods.read.format;
            let screen = action.methods.read.screen;

            // Trigger bleRead at startTime with format
            action.StartTimeoutId = setTimeout(() => {
              blRead(device, format, screen);
            }, startTime);

            // Trigger bleStopRead at endTime with format
            action.StopTimeoutId = setTimeout(() => {
              blStopRead(device, format);
            }, endTime);
          }
        });
      });
    }

    function cancelTimeline(){
      const timelineCancelTime = new Date()
      let pastTime = timelineCancelTime - timelineStartTime

      timelineJson.forEach((entry) => {
        let device = entry.name;

        entry.actions.forEach((action) => {

          const timelineStartTime = new Date()

          let startTime = parseTime(action.startTime);
          let endTime = parseTime(action.endTime);

          if (action.methods.hasOwnProperty('write')) {

            let startData = action.methods.write.startData;
            let stopData = action.methods.write.stopData;

            if(startTime > pastTime){
              clearTimeout(action.StartTimeoutId);
            }
            if(endTime > pastTime){
              clearTimeout(action.StopTimeoutId);
              blSend(device, stopData);
            }
          }

          if (action.methods.hasOwnProperty('read')) {

            let format = action.methods.read.format;
            let screen = action.methods.read.screen;

            if(startTime > pastTime){
              clearTimeout(action.StartTimeoutId);
            }
            if(endTime > pastTime){
              clearTimeout(action.StopTimeoutId);
              blStopRead(device, format);
            }
          }
        });
      });
    }

    // Helper function to parse time in mm:ss format and return milliseconds
    function parseTime(timeStr) {
      const [minutes, seconds] = timeStr.split(':').map(Number);
      return minutes * 60 * 1000 + seconds * 1000;
    }


    function timelineDataToLocalstorage(){
      let timelineString = JSON.stringify(timelineJson)
      //localStorage.setItem('timeline_data', timelineString)

      const url = `https://127.0.0.1:5000/save_application_timeline?id={{context.application.id}}`;

      const headers = {
          "Content-Type": "application/json"
      };

      const payload = {
          'timeline': timelineString,

      };

      fetch(url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload)
      })
      .then(response => {
          console.log(response.status);
      })
      .catch(error => {
          console.error(error);
      });
    }

    function getTimelineData(){
      try {
          timelineJson = JSON.parse('{{context.application.timeline|safe}}');
          console.log(timelineJson)
          buildTimeline()
        } catch (error) {
          console.log('Error parsing stored data:', error);
        }
        /*
        let timelineString = localStorage.getItem('timeline_data');
        if (timelineString) {
          try {
            timelineJson = JSON.parse(timelineString);
            buildTimeline()
          } catch (error) {
            console.error('Error parsing stored data:', error);
          }
        }*/
      }
