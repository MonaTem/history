import warning from 'warning';
import { PUSH, REPLACE, POP } from './Actions';
import { addEventListener, removeEventListener, readState, saveState, getHashPath, replaceHashPath, go } from './DOMUtils';
import createDOMHistory from './createDOMHistory';
import createLocation from './createLocation';

function isAbsolutePath(path) {
  return typeof path === 'string' && path.charAt(0) === '/';
}

function ensureSlash() {
  var path = getHashPath();

  if (isAbsolutePath(path))
    return true;

  replaceHashPath('/' + path);

  return false;
}

function addQueryStringValueToPath(path, key, value) {
  return path + (path.indexOf('?') === -1 ? '?' : '&') + `${key}=${value}`;
}

function stripQueryStringValueFromPath(path, key) {
  return path.replace(new RegExp(`[?&]?${key}=[a-zA-Z0-9]+`), '');
}

function getQueryStringValueFromPath(path, key) {
  var match = path.match(new RegExp(`\\?.*?\\b${key}=(.+?)\\b`));
  return match && match[1];
}

var DefaultQueryKey = '_k';

function createHashHistory(options={}) {
  var { queryKey } = options;

  if (queryKey === undefined || !!queryKey)
    queryKey = typeof queryKey === 'string' ? queryKey : DefaultQueryKey;

  function getCurrentLocation() {
    var path = getHashPath();
    
    var key, state;
    if (queryKey) {
      key = getQueryStringValueFromPath(path, queryKey);
      path = stripQueryStringValueFromPath(path, queryKey);
      state = key && readState(key);
    }

    return createLocation(path, state, undefined, key);
  }

  var ignoreNextHashChange = false, lastHashPath;

  function startHashChangeListener({ transitionTo }) {
    function listener() {
      if (!ensureSlash())
        return; // Always make sure hashes are preceeded with a /.

      var hashPath = getHashPath();
      if (hashPath === lastHashPath)
        return; // Ignore consecutive identical hashes (it hasn't actually changed!).

      lastHashPath = hashPath;

      if (ignoreNextHashChange) {
        ignoreNextHashChange = false;
        return;
      }

      transitionTo(
        getCurrentLocation()
      );
    }

    ensureSlash();
    addEventListener(window, 'hashchange', listener);

    return function () {
      removeEventListener(window, 'hashchange', listener);
    };
  }

  function finishTransition(location) {
    var { key, pathname, search, action } = location;

    if (action === POP)
      return; // Nothing to do.

    var path = pathname + search;

    if (queryKey)
      path = addQueryStringValueToPath(path, queryKey, key);

    if (path === getHashPath()) {
      warning(
        false,
        'You cannot %s the same path using hash history',
        action
      );
    } else {
      ignoreNextHashChange = true;

      if (queryKey)
        saveState(location.key, location.state);

      if (action === PUSH) {
        window.location.hash = path;
      } else {
        replaceHashPath(path);
      }
    }
  }

  function cancelTransition(location) {
    if (location.action === POP) {
      var n = 0; // TODO: Figure out what n will put the URL back.

      if (n) {
        ignoreNextHashChange = true;
        go(n);
      }
    }
  }

  var history = createDOMHistory({
    ...options,
    getCurrentLocation,
    finishTransition,
    cancelTransition
  });

  var listenerCount = 0, stopHashChangeListener;

  function listen(listener) {
    if (++listenerCount === 1)
      stopHashChangeListener = startHashChangeListener(history);

    var unlisten = history.listen(listener);

    return function () {
      unlisten();

      if (--listenerCount === 0)
        stopHashChangeListener();
    };
  }

  return {
    ...history,
    listen
  };
}

export default createHashHistory;
