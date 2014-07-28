var
  MyQ = require('liftmaster'),
  util = require('util'),
  garageDoor = new MyQ('username', 'password'),
  doorStates = {
    '1': 'open',
    '2': 'closed',
    '4': 'opening',
    '5': 'closing'
  };


// log in to MyQ
garageDoor.login(function(err) {
  if(!!err) return console.log(err);

  // get all garage door devices
  garageDoor.getDevices(function(err, devices) {
    if(!!err) return console.log(err);

    console.log(util.inspect(devices, { depth: null }));

    // log each door state
    devices.forEach(function(device) {
      console.log(util.inspect(device, { depth: null }));
      console.log('    doorState=' + doorStates[device.state]);

      garageDoor.getDoorState(device.id, function(err, door) {
        console.log('>>> getDoorState ' + device.id + ' !!err=' + (!!err) + ' !!door=' + (!!door));
        if(!!err) return console.log(err);

        console.log(util.inspect(door, { depth: null }));
        console.log('    state=' + doorStates[door.state]);
      });
    });
  });
});
