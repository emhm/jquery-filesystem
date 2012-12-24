(function($) {
	var
		FILESYSTEM_VERSION = '0.0.1';
		
		requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
	
	var
		_quotaSize = 100,
		_bytes = 0;
	
	function _init(options) {
		if (!_supported()) {
			throw 'File system not supported!';
		}

		window.webkitStorageInfo.requestQuota(window.PERSISTENT, _newSize(), function(bytes) {
			_bytes = bytes;
			
			if (options) {
				_doAction(options);
			}
		}, function (e) {
			console.log('Error', e);
		});
		
		return true;
	}
	
	function _errorCallback(e) {
		var msg = '';

		switch (e.code) {
			case FileError.QUOTA_EXCEEDED_ERR:
				msg = 'QUOTA_EXCEEDED_ERR';
				break;
			case FileError.NOT_FOUND_ERR:
				msg = 'NOT_FOUND_ERR';
				break;
			case FileError.SECURITY_ERR:
				msg = 'SECURITY_ERR';
				break;
			case FileError.INVALID_MODIFICATION_ERR:
				msg = 'INVALID_MODIFICATION_ERR';
				break;
			case FileError.INVALID_STATE_ERR:
				msg = 'INVALID_STATE_ERR';
				break;
			default:
				msg = 'Unknown Error';
				break;
		};
		
		console.log('Error: ' + msg);
	}
	
	function _newSize() {
		return _quotaSize * 1024 * 1024;
	}
	
	function _supported() {
		return !!requestFileSystem;
	}
	
	function _createDir(dir, folders, cb, fs) {
		if (folders[0] == '.' || folders[0] == '') {
			folders = folders.slice(1);
		}
		
		if (folders.length < 1) {
			return;
		}
		
		dir.getDirectory(folders.shift(), {create: true}, function(dir) {
			if (folders.length > 0) {
				_createDir(dir, folders, cb, fs);
			}
			else if (cb && fs) {
				cb(fs);
			}
			else if (cb) {
				cb();
			}
		}, _errorCallback);
	}
	
	function _getFile(options, cb) {
		return function(fs) {
			fs.root.getFile(options.file, options.options.file, cb, _errorCallback);
		};
	}
	
	function _doReadFile(options) {
		var handleFile = function(file) {
			file.file(function(file) {
				var reader = new FileReader();
				reader.onloadend = options.onSuccess;
				
				reader.readAsText(file);
			}, _errorCallback);
		};
		
		return _getFile(options, handleFile);
	}
	
	function _doWriteFile(options) {
		var handleFile = function(file) {
			file.createWriter(function(writer) {
				writer.onerror = options.onError;
				
				if (options.options.truncateFile) {
					writer.truncate(0);
					
					writer.onwriteend = function() {
						writer.onwriteend = options.onSuccess;
						
						writer.write(options.data);
					}
					
					return;
				}
				
				writer.onwriteend = options.onSuccess;
				
				writer.seek(writer.length);
				writer.write(options.data);
			}, _errorCallback);
		};
		
		return _getFile(options, handleFile);
	}
	
	function _doRemoveFile(options) {
		var handleFile = function(file) {
			file.remove(options.onSuccess, _errorCallback);
		};
		
		return _getFile(options, handleFile);
	}
	
	function _doCreateDir(options) {
		return function(fs) {
			var folders = options.path.replace('\\', '/').split('/');
			if (folders.length > 1) {
				return _createDir(fs.root, folders, options.onSuccess);
			}
		
			_createDir(fs, options.path);
		};
	}
	
	function _doAction(options) {
		if (!options.onError) {
			options.onError = function() { };
		}
		
		if (!options.onSuccess) {
			options.onSuccess = function() { };
		}
		
		if (!options.type) {
			return false;
		}
		
		if (options.type == 'writeFile' || options.type == 'readFile' || options.type == 'removeFile') {
			if (options.type == 'writeFile' && !options.data) {
				return false;
			}
			
			if (!options.file && (options.type == 'witeFile' || options.type == 'readFile' || options.type == 'removeFile')) {
				return false;
			}
			
			if (!options.options) {
				options.options = {'file': {'create': false}};
			}
			else if (!options.options.file) {
				options.options.file = {'create': false};
			}
			
			if (options.type == 'writeFile') {
				var handleAction = _doWriteFile(options);
			}
			else if (options.type == 'readFile') {
				var handleAction = _doReadFile(options);
			}
			else if (options.type == 'removeFile') {
				var handleAction = _doRemoveFile(options);
			}
			
			var handleFileSystem = function(fs) {
				if (options.options.createDir) {
					var folders = options.file.replace('\\', '/').split('/');
					if (folders.length > 1) {
						return _createDir(fs.root, folders.slice(0, -1), handleAction, fs);
					}
				}
				
				handleAction(fs);
			};
		}
		else if (options.type == 'createDir' || options.type == 'getDir' || options.type == 'removeDir') {
			if (options.type == 'createDir') {
				var handleAction = _doCreateDir(options);
			}
			/*else if (options.type == 'getDir') {
				var handleAction = doGetDir(options);
			}
			else if (options.type == 'removeDir') {
				var handleAction = _doRemoveDir(options);
			}*/
			
			var handleFileSystem = handleAction;
		}
		else {
			return false;
		}

		requestFileSystem((options.persistent) ? window.PERSISTENT : window.TEMPORARY, _bytes, handleFileSystem, _errorCallback);
	
		return true;
	}
	
	$.fileSystem = function(options) {
		if (_bytes == 0 && options.persistent) {
			return _init(options);
		}
		
		return _doAction(options);
	}
})(jQuery);