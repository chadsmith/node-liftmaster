var request = require('request');

var MyQ = module.exports = function(username, password) {
  this.endpoint = 'https://myqexternal.myqdevice.com';
  this.appId = 'NWknvuBd7LoFHfXmKNMBcgajXtZEgKUh4V7WNzMidrpUUluDpVYVZx+xT4PCM5Kx';
  this.username = username;
  this.password = password;
  this.brandID = 'Chamberlain';
  this.expiration = 0;
};

MyQ.prototype.login = function(callback) {
  var _self = this;
  request({
    method: 'GET',
    uri: _self.endpoint + '/api/user/validatewithculture',
    headers: {
      'User-Agent': _self.brandID + '/1332 (iPhone; iOS 7.1.1; Scale/2.00)'
    },
    qs: {
      appId: _self.appId,
      username: _self.username,
      password: _self.password,
      culture: 'en',
      filterOn: true
    },
    json: true
  }, function(err, res, body) {
    if(err || body.Message || body.ErrorMessage)
      return callback(err || new Error(body.Message || body.ErrorMessage));

    _self.userId = body.UserId;
    _self.securityToken = body.SecurityToken;
    _self.brandID = body.BrandName;
    _self.expiration = new Date().getTime() + (5 * 60 * 1000);

    callback(null, body);
  });
};

MyQ.prototype.getDevices = function(callback) {
  var _self = this;

  if(!_self.securityToken) callback(new Error('not logged in'));
  if(_self.expiration <= new Date().getTime()) {
    return _self.login(function(err) {
      if(!!err) return callback(err);

      _self.getDevices(callback);
    });
  }

  request({
    method: 'GET',
    uri: _self.endpoint + '/api/userdevicedetails/get',
    headers: {
      'User-Agent': _self.brandID + '/1332 (iPhone; iOS 7.1.1; Scale/2.00)'
    },
    qs: {
      appId: _self.appId,
      securityToken: _self.securityToken,
    },
    json: true
  }, function(err, res, body) {
    if(err || body.Message || body.ErrorMessage)
      return callback(err || new Error(body.Message || body.ErrorMessage));

    _self.gateways = [];
    _self.children = {};
    body.Devices.forEach(function(Device) {
      if(Device.TypeId != 49) return;

      var gateway = {
        id: Device.DeviceId, type: 'gateway', serialNo: Device.SerialNumber, name: Device.DeviceName, devices: []
      };
      var response;
      Device.Attributes.forEach(function(attribute) {
        if(attribute.Name === 'desc') gateway.name = attribute.Value;
        else if(attribute.Name === 'devices') gateway.devices = attribute.Value.split(',');
        else if(attribute.Name === 'deviceRecord.response') response = attribute.Value;
      });
      _self.gateways.push(gateway);
      gateway.devices.forEach(function(deviceId) {
        if ((!!response) && (response.indexOf(deviceId) === -1)) return;

        _self.children[deviceId] = { location: gateway.name };
      });
    });

    _self.devices = [];
    body.Devices.forEach(function(Device) {
      if((Device.TypeId != 47) && (Device.TypeId != 259)) return;
      if(!_self.children[Device.DeviceId]) return;
      Device.Location = _self.children[Device.DeviceId].location;
      _self.children[Device.DeviceId] = Device;

      var device = {
        id: Device.DeviceId, type: 'garageDoor', serialNo: Device.DeviceName, name: 'Garage Door Opener',
        location: Device.Location
      };
      Device.Attributes.forEach(function(attribute) {
        if(attribute.Name === 'desc')
          device.name = attribute.Value;
        if(attribute.Name === 'doorstate') {
          device.state = attribute.Value;
          device.updated = attribute.UpdatedTime;
        }
      });
      _self.devices.push(device);
    });

    callback(null, _self.devices);
  });
};

MyQ.prototype.getDoorState = function(deviceId, callback) {
  var _self = this;

  if(!_self.securityToken) callback(new Error('not logged in'));
  if(_self.expiration <= new Date().getTime()) {
    return _self.login(function(err) {
      if(!!err) return callback(err);

      _self.getDoorState(deviceId, callback);
    });
  }

  request({
    method: 'GET',
    uri: _self.endpoint + '/api/deviceattribute/getdeviceattribute',
    headers: {
      'User-Agent': _self.brandID + '/1332 (iPhone; iOS 7.1.1; Scale/2.00)'
    },
    qs: {
      appId: _self.appId,
      securityToken: _self.securityToken,
      devId: deviceId,
      name: 'doorstate'
    },
    json: true
  }, function(err, res, body) {
    if(err || body.Message || body.ErrorMessage)
      return callback(err || new Error(body.Message || body.ErrorMessage));

    _self.devices.forEach(function(device) {
      if(device.id == deviceId) {
        device.state = body.AttributeValue;
        device.updated = body.UpdatedTime;
        callback(null, device);
      }
    });
  });
};

MyQ.prototype.setDoorState = function(deviceId, state, callback) {
  var _self = this;

  if(!_self.securityToken) callback(new Error('not logged in'));
  if(_self.expiration <= new Date().getTime()) {
    return _self.login(function(err) {
      if(!!err) return callback(err);

      _self.setDoorState(deviceId, state, callback);
    });
  }

  request({
    method: 'PUT',
    uri: _self.endpoint + '/api/deviceattribute/putdeviceattribute',
    body: {
      DeviceId: deviceId,
      AttributeName: 'desireddoorstate',
      AttributeValue: state,
      securityToken: _self.securityToken
    },
    json: true
  }, function(err, res, body) {
    if(err || body.Message || body.ErrorMessage)
      return callback(err || new Error(body.Message || body.ErrorMessage));

    setTimeout(function() {
      _self._loopDoorState(deviceId, callback);
    }, 1000);
  });
};

MyQ.prototype._loopDoorState = function(deviceId, callback) {
  var _self = this;


  _self.getDoorState(deviceId, function(err, res) {
    if(err)
      return callback(err);

    if((res.state !== 4) && (res.state !== 5)) return callback(null, res);

    setTimeout(function() {
      _self._loopDoorState(deviceId, callback);
    }, 5000);
  });
};
