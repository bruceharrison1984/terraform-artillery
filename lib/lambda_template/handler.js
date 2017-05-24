'use strict';

/* eslint-disable no-underscore-dangle */

// TODO remove AWS specific code and dependencies.
// TODO i.e. move to plugable module (specifically the ntp-client and invokeSelf code)

const artillery = require('artillery-core');
const aws = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies
const csv = require('csv-parse/lib/sync');
const fs = require('fs');
const path = require('path');

const lambda = new aws.Lambda({ maxRetries: 0 });
const constants = {
  CLOCK_DRIFT_THRESHOLD: 250,
  /**
   * The hard coded maximum duration for an entire load test (as a set of jobs) in seconds.
   * (_split.maxScriptDurationInSeconds must be set in your script if you want to use values up to this length)
   */
  MAX_SCRIPT_DURATION_IN_SECONDS: 518400, // 6 days
  /**
   * The default maximum duration for an entire load test (as a set of jobs) in seconds
   */
  DEFAULT_MAX_SCRIPT_DURATION_IN_SECONDS: 86400, // 1 day
  /**
   * The default maximum number of concurrent lambdas to invoke with the given script.
   * (_split.maxScriptRequestsPerSecond must be set in your script if you want to use values up to this rate)
   */
  MAX_SCRIPT_REQUESTS_PER_SECOND: 50000,
  /**
   * The default maximum number of concurrent lambdas to invoke with the given script
   */
  DEFAULT_MAX_SCRIPT_REQUESTS_PER_SECOND: 5000,
  /**
   * The hard coded maximum duration for a single lambda to execute in seconds this should probably never change until
   * Lambda maximums are increased.
   * (_split.maxChunkDurationInSeconds must be set in your script if you want to use values up to this length)
   */
  MAX_CHUNK_DURATION_IN_SECONDS: 285, // 4 minutes and 45 seconds (allow for 15 second alignment time)
  /**
   * The default maximum duration for a scenario in seconds (this is how much time a script is allowed to take before
   * it will be split across multiple function executions)
   */
  DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS: 240, // 4 minutes
  /**
   * The hard coded maximum number of requests per second that a single lambda should attempt.  This is more than a
   * fully powered Lambda can properly perform without impacting the measurements.
   * (_split.maxChunkRequestsPerSecond must be set in your script if you want to use values up to this rate)
   */
  MAX_CHUNK_REQUESTS_PER_SECOND: 500,
  /**
   * The default maximum number of requests per second that a single lambda should attempt
   */
  DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND: 25,
  /**
   * The hard coded maximum number of seconds to wait for your functions to start producing load.
   * (_split.timeBufferInMilliseconds must be set in your script if you want to use values up to this length)
   */
  MAX_TIME_BUFFER_IN_MILLISECONDS: 30000,
  /**
   * The default amount of buffer time to provide between starting a "next job" (to avoid cold starts and the
   * like) in milliseconds
   */
  DEFAULT_MAX_TIME_BUFFER_IN_MILLISECONDS: 15000,
};
const simulation = {
  callback: (err, res) => {
    console.log(`SIMULATION: err: ${err}`);
    console.log(`SIMULATION: res: ${res}`);
  },
  context: {
    functionName: 'simulationFunctionName',
  },
};
const impl = {
  /**
   * Obtain settings, replacing any of the defaults with user supplied values.
   * @param script The script that split settings were supplied to.
   * @returns
   * {
   *   {
   *     maxScriptDurationInSeconds: number,
   *     maxScriptRequestsPerSecond: number,
   *     maxChunkDurationInSeconds: number,
   *     maxChunkRequestsPerSecond: number,
   *     timeBufferInMilliseconds: number,
   *   }
   * }
   * The settings for the given script which consists of defaults overwritten by any user supplied values.
   */
  getSettings: (script) => {
    const ret = {
      maxScriptDurationInSeconds: constants.DEFAULT_MAX_SCRIPT_DURATION_IN_SECONDS,
      maxScriptRequestsPerSecond: constants.DEFAULT_MAX_SCRIPT_REQUESTS_PER_SECOND,
      maxChunkDurationInSeconds: constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS,
      maxChunkRequestsPerSecond: constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND,
      timeBufferInMilliseconds: constants.DEFAULT_MAX_TIME_BUFFER_IN_MILLISECONDS,
    };
    if (script._split) {
      if (script._split.maxScriptDurationInSeconds) {
        ret.maxScriptDurationInSeconds = script._split.maxScriptDurationInSeconds;
      }
      if (script._split.maxChunkDurationInSeconds) {
        ret.maxChunkDurationInSeconds = script._split.maxChunkDurationInSeconds;
      }
      if (script._split.maxScriptRequestsPerSecond) {
        ret.maxScriptRequestsPerSecond = script._split.maxScriptRequestsPerSecond;
      }
      if (script._split.maxChunkRequestsPerSecond) {
        ret.maxChunkRequestsPerSecond = script._split.maxChunkRequestsPerSecond;
      }
      if (script._split.timeBufferInMilliseconds) {
        ret.timeBufferInMilliseconds = script._split.timeBufferInMilliseconds;
      }
    }
    return ret;
  },
  /**
   * Obtain the duration of a phase in seconds.
   * @param phase The phase to obtain duration from.
   * @returns {number} The duration of the given phase in seconds.  If a duration cannot be obtained -1 is returned.
   */
  phaseLength: (phase) => {
    if ('duration' in phase) {
      return phase.duration;
    } else if ('pause' in phase) {
      return phase.pause;
    } else {
      return -1;
    }
  },
  /**
   * Calculate the total duration of the Artillery script in seconds.  If a phase does not have a valid duration,
   * the index of that phase, multiplied by -1, will be returned.  This way a result less than zero result can
   * easily be differentiated from a valid duration and the offending phase can be identified.
   * @param script The script to identify a total duration for.
   * @returns {number} The total duration for the given script.  If any phases do not contain a valid duration,
   * the index of the first phase without a valid duration will be returned, multiplied by -1.
   */
  scriptLength: (script) => {
    let ret = 0;
    let i;
    let phaseLength;
    for (i = 0; i < script.config.phases.length; i++) {
      phaseLength = impl.phaseLength(script.config.phases[i]);
      if (phaseLength < 0) {
        ret = -1 * i;
        break;
      } else {
        ret += phaseLength;
      }
    }
    return ret;
  },
  /**
   * Obtain the specified requests per second of a phase.
   * @param phase The phase to obtain specified requests per second from.
   * @returns The specified requests per second of a phase.  If a valid specification is not available, -1 is returned.
   */
  phaseWidth: (phase) => {
    if ('rampTo' in phase && 'arrivalRate' in phase) {
      return Math.max(phase.arrivalRate, phase.rampTo);
    } else if ('arrivalRate' in phase) {
      return phase.arrivalRate;
    } else if ('arrivalCount' in phase && 'duration' in phase) {
      return phase.arrivalCount / phase.duration;
    } else if ('pause' in phase) {
      return 0;
    } else {
      return -1;
    }
  },
  /**
   * Calculate the maximum width of a script in RPS.  If a phase does not have a valid width, the index of that
   * phase, multiplied by -1, will be returned.  This way a result less than zero result can easily be
   * differentiated from a valid width and the offending phase can be identified.
   *
   * @param script The script to identify a maximum width for.
   * @returns {number} The width of the script in RPS (Requests Per Second) or -1 if an invalid phase is encountered.
   */
  scriptWidth: (script) => {
    /*
     * See https://artillery.io/docs/script_reference.html#phases for phase types.
     *
     * The following was obtained 07/26/2016:
     * arrivalRate - specify the arrival rate of virtual users for a duration of time. - A linear “ramp” in arrival
     *      can be also be created with the rampTo option.                          // max(arrivalRate, rampTo) RPS
     * arrivalCount - specify the number of users to create over a period of time.  // arrivalCount/duration RPS
     * pause - pause and do nothing for a duration of time.                         // zero RPS
     */
    let ret = 0;
    let i;
    let phaseWidth;
    for (i = 0; i < script.config.phases.length; i++) {
      phaseWidth = impl.phaseWidth(script.config.phases[i]);
      if (phaseWidth < 0) {
        ret = -1 * i;
        break;
      } else {
        ret = Math.max(ret, phaseWidth);
      }
    }
    return ret;
  },
  /**
   * Validate the given script
   * @param script The script given to the handler
   * @param context The handler's context
   * @param callback The callback to invoke with error or success
   * @returns {boolean} Whether the script was valid
   */
  validScript: (script, context, callback) => {
    let ret = false;
    let scriptLength;
    let scriptWidth;
    const settings = impl.getSettings(script);
    // Splitting Settings [Optional]
    if (script._split && typeof script._split !== 'object') {
      callback('If specified, the "_split" attribute must contain an object');
    } else if (
      settings.maxChunkDurationInSeconds &&
      !(Number.isInteger(settings.maxChunkDurationInSeconds) &&
      settings.maxChunkDurationInSeconds > 0 &&
      settings.maxChunkDurationInSeconds <= constants.MAX_CHUNK_DURATION_IN_SECONDS)
    ) {
      callback('If specified the "_split.maxChunkDuration" attribute must be an integer inclusively between ' +
        `1 and ${constants.MAX_CHUNK_DURATION_IN_SECONDS}.`);
    } else if (
      settings.maxScriptDurationInSeconds &&
      !(Number.isInteger(settings.maxScriptDurationInSeconds) &&
      settings.maxScriptDurationInSeconds > 0 &&
      settings.maxScriptDurationInSeconds <= constants.MAX_SCRIPT_DURATION_IN_SECONDS)
    ) {
      callback('If specified the "_split.maxScriptDuration" attribute must be an integer inclusively between ' +
      `1 and ${constants.MAX_SCRIPT_DURATION_IN_SECONDS}.`);
    } else if (
      settings.maxChunkRequestsPerSecond &&
      !(Number.isInteger(settings.maxChunkRequestsPerSecond) &&
      settings.maxChunkRequestsPerSecond > 0 &&
      settings.maxChunkRequestsPerSecond <= constants.MAX_CHUNK_REQUESTS_PER_SECOND)
    ) {
      callback('If specified the "_split.maxChunkRequestsPerSecond" attribute must be an integer inclusively ' +
        `between 1 and ${constants.MAX_CHUNK_REQUESTS_PER_SECOND}.`);
    } else if (
      settings.maxScriptRequestsPerSecond &&
      !(Number.isInteger(settings.maxScriptRequestsPerSecond) &&
      settings.maxScriptRequestsPerSecond > 0 &&
      settings.maxScriptRequestsPerSecond <= constants.MAX_SCRIPT_REQUESTS_PER_SECOND)
    ) {
      callback('If specified the "_split.maxScriptRequestsPerSecond" attribute must be an integer inclusively ' +
        `between 1 and ${constants.MAX_SCRIPT_REQUESTS_PER_SECOND}.`);
    } else if (
      settings.timeBufferInMilliseconds &&
      !(Number.isInteger(settings.timeBufferInMilliseconds) &&
      settings.timeBufferInMilliseconds > 0 &&
      settings.timeBufferInMilliseconds <= constants.MAX_TIME_BUFFER_IN_MILLISECONDS)
    ) {
      callback('If specified the "_split.timeBufferInMilliseconds" attribute must be an integer inclusively ' +
        `between 1 and ${constants.MAX_TIME_BUFFER_IN_MILLISECONDS}.`);
      // Validate the Phases
    } else if (!(script.config && Array.isArray(script.config.phases) && script.config.phases.length > 0)) {
      callback('An Artillery script must contain at least one phase under the $.config.phases attribute which ' +
        'itself must be an Array');
    } else {
      scriptLength = impl.scriptLength(script); // determine length and width
      scriptWidth = impl.scriptWidth(script);
      if (scriptLength < 0) {
        callback('Every phase must have a valid duration.  ' +
          `Observed: ${JSON.stringify(script.config.phases[scriptLength * -1])}`);
      } else if (scriptLength > settings.maxScriptDurationInSeconds) {
        callback(`The total duration of all script phases cannot exceed ${settings.maxScriptDurationInSeconds}`);
      } else if (scriptWidth < 0) {
        callback('Every phase must have a valid means to determine requests per second.  ' +
          `Observed: ${JSON.stringify(script.config.phases[scriptWidth * -1])}`);
      } else if (scriptWidth > settings.maxScriptRequestsPerSecond) {
        callback('The maximum requests per second of any script phase cannot ' +
        `exceed ${settings.maxScriptRequestsPerSecond}`);
      } else {
        ret = true;
      }
    }
    return ret;
  },
  /**
   * Split the given phase along the time dimension so that the resulting chunk is no longer than the given chunkSize
   * @param phase The phase to split so that the produced chunk is no more than chunkSize seconds long
   * @param chunkSize The length, in seconds, that the chunk removed from the phase should be no longer than
   * @returns {{chunk, remainder: *}} The chunk that is chunkSize length and the remainder of the phase.
   */
  splitPhaseByLength: (phase, chunkSize) => {
    const ret = {
      chunk: JSON.parse(JSON.stringify(phase)),
      remainder: phase,
    };
    let diff;
    let ratio;
    if ('duration' in phase) {
      // split the ramp - the rampTo for the chunk and the arrival rate for the remainder are changed.
      if ('rampTo' in phase && 'arrivalRate' in phase) {
        // if arrivalRate < rampTo (ramping down) this will be negative, that's okay
        diff = phase.rampTo - phase.arrivalRate;
        ratio = chunkSize / phase.duration;
        // TODO should we round?  Potentially, this could lead to non-smooth ramps
        ret.chunk.rampTo = Math.round(ret.chunk.arrivalRate + (diff * ratio));
        ret.remainder.arrivalRate = ret.chunk.rampTo;
      } else if ('arrivalCount' in phase) { // split the arrival count proportionally
        ratio = chunkSize / phase.duration;
        // TODO should we round?  Potentially, this could lead to non-constant arrivals
        ret.chunk.arrivalCount = Math.round(ret.chunk.arrivalCount * ratio);
        ret.remainder.arrivalCount -= ret.chunk.arrivalCount;
      }
      // nothing to do in the 'arrivalRate' ONLY case, since arrivalRate doesn't change based on time reduction
      ret.chunk.duration = chunkSize;
      ret.remainder.duration -= chunkSize;
    } else if ('pause' in phase) {
      ret.chunk.pause = chunkSize;
      ret.remainder.pause -= chunkSize;
    }
    return ret;
  },
  /**
   * Split the given script along the time dimension so that the resulting chunk is no longer than the given chunkSize
   * @param script The script to split so that the produced chunk is no more than chunkSize seconds long
   * @param chunkSize The length, in seconds, that the chunk removed from the script should be no longer than
   * @returns {{chunk, remainder: *}} The chunk that is chunkSize length and the remainder of the script.
   */
  splitScriptByLength: (script, chunkSize) => {
    const ret = {
      chunk: JSON.parse(JSON.stringify(script)),
      remainder: script,
    };
    let remainingDuration = chunkSize;
    let phase;
    let phaseLength;
    let phaseParts;
    ret.chunk.config.phases = [];
    if (ret.remainder._start) {
      delete ret.remainder._start;
    }
    while (remainingDuration > 0 && ret.remainder.config.phases.length) {
      phase = ret.remainder.config.phases.shift();
      phaseLength = impl.phaseLength(phase);
      if (phaseLength > remainingDuration) { // split phase
        phaseParts = impl.splitPhaseByLength(phase, remainingDuration);
        ret.chunk.config.phases.push(phaseParts.chunk);
        ret.remainder.config.phases.unshift(phaseParts.remainder);
        remainingDuration = 0;
      } else {
        ret.chunk.config.phases.push(phase);
        remainingDuration -= phaseLength;
      }
    }
    return ret;
  },
  // Given that we have a flat line, abc and intersection should be reducible to fewer instructions.
  // sigh... time constraints.
  /**
   * Determine the Ax +By = C specification of the strait line that intersects the two given points
   * See https://www.topcoder.com/community/data-science/data-science-tutorials/geometry-concepts-line-intersection-and-its-applications/
   * @param p1 The first point of the line segment to identify.  E.g. { x: 0, y: 0 }
   * @param p2 The second point of the line segment to identify.  E.g. { x: 2, y: 2 }
   * @returns
   * {
   *   {
   *     A: number,
   *     B: number,
   *     C: number
   *   }
   * }
   * The line specification (Ax +By = C) running through the two given points.  E.g. { A: 2, B: -2, C: 0 }
   */
  abc: (p1, p2) => {
    const ret = {
      A: p2.y - p1.y,
      B: p1.x - p2.x,
    };
    ret.C = (ret.A * p1.x) + (ret.B * p1.y);
    return ret;
  },
  /**
   * Determine the intersection point of two lines specified by an A, B, C trio
   * See https://www.topcoder.com/community/data-science/data-science-tutorials/geometry-concepts-line-intersection-and-its-applications/
   * @param l1 The first line to determine the intersection point for.  E.g. { A: 2, B: -2, C: 0 }
   * @param l2 The second line to determine the intersection point for.  E.g. { A: 0, B: -2, C: -2 }
   * @returns {{x: number, y: number}} The point of intersection between the two given lines.  E.g. {x: 1, y: 1}
   */
  intersect: (l1, l2) => {
    const ret = {};
    const det = (l1.A * l2.B) - (l2.A * l1.B);
    if (det === 0) {
      throw new Error('Parallel lines never intersect, detect and avoid this case');
    } else {
      ret.x = Math.round(((l2.B * l1.C) - (l1.B * l2.C)) / det);
      ret.y = Math.round(((l1.A * l2.C) - (l2.A * l1.C)) / det);
    }
    return ret;
  },
  /**
   * Determine the intersection of the phase's ramp specification with the chunkSize limit
   * @param phase The phase to intersect with the given chunkSize limit
   * @param chunkSize The limit to RPS for the given phase
   * @returns {{x: number, y: number}} The intersection point of the phase's ramp with the chunkSize limit
   */
  intersection: (phase, chunkSize) => {
    const ramp = impl.abc({ x: 0, y: phase.arrivalRate }, { x: phase.duration, y: phase.rampTo });
    const limit = impl.abc({ x: 0, y: chunkSize }, { x: phase.duration, y: chunkSize });
    return impl.intersect(ramp, limit);
  },
  /**
   * Overwrite the given field with the given value in the given phase.  If the value is null, then if the attribute
   * is defined in the given phase, delete the attribute from the phase.
   * @param phase The phase to alter
   * @param field The field in the phase to set or delete
   * @param value The value to set the field of the phase to have or, if null, to delete
   */
  overWrite: (phase, field, value) => {
    if (value !== null) {
      phase[field] = value; // eslint-disable-line no-param-reassign
    } else if (field in phase) {
      delete phase[field]; // eslint-disable-line no-param-reassign
    }
  },
  /**
   * Copy the given phase, overwriting it's values with the given values, and then push the result to the given array
   * @param arr The array to put the resulting phase copy into
   * @param phase The phase to copy
   * @param arrivalCount The arrivalCount value to set (see artillery.io)
   * @param arrivalRate The arrivalRate value to set (see artillery.io)
   * @param rampTo The rampTo value to set (see artillery.io)
   * @param duration The duration value to set (see artillery.io)
   * @param pause The pause value to set (see artillery.io)
   */
  copyOverwritePush: (arr, phase, arrivalCount, arrivalRate, rampTo, duration, pause) => {
    const newPhase = JSON.parse(JSON.stringify(phase));
    impl.overWrite(newPhase, 'arrivalCount', arrivalCount);
    impl.overWrite(newPhase, 'arrivalRate', arrivalRate);
    impl.overWrite(newPhase, 'rampTo', rampTo);
    impl.overWrite(newPhase, 'duration', duration);
    impl.overWrite(newPhase, 'pause', pause);
    arr.push(newPhase);
  },
  /**
   * Add an arrivalCount phase that is an altered copy of the given phase to the given phase array
   * @param arr The array to add the specified phase to
   * @param phase The phase to copy and alter
   * @param arrivalCount The arrivalCount of the new phase (see artillery.io)
   * @param duration The duration of the new phase (see artillery.io)
   */
  addArrivalCount: (arr, phase, arrivalCount, duration) => {
    impl.copyOverwritePush(arr, phase, arrivalCount, null, null, duration, null);
  },
  /**
   * Add an arrivalRate phase that is an altered copy of the given phase to the given phase array
   * @param arr The array to add the specified phase to
   * @param phase The phase to copy and alter
   * @param arrivalRate The arrivalRate of the new phase (see artillery.io)
   * @param duration The duration of the new phase (see artillery.io)
   */
  addArrivalRate: (arr, phase, arrivalRate, duration) => {
    impl.copyOverwritePush(arr, phase, null, arrivalRate, null, duration, null);
  },
  /**
   * Add an arrivalRate phase that is an altered copy of the given phase to the given phase array
   * @param arr The array to add the specified phase to
   * @param phase The phase to copy and alter
   * @param arrivalRate The arrivalRate of the new phase (see artillery.io)
   * @param rampTo The rampTo of the new phase (see artillery.io)
   * @param duration The duration of the new phase (see artillery.io)
   */
  addRamp: (arr, phase, arrivalRate, rampTo, duration) => {
    impl.copyOverwritePush(arr, phase, null, arrivalRate > 0 ? arrivalRate : 1, rampTo, duration, null);
  },
  /**
   * Add an arrivalRate phase that is an altered copy of the given phase to the given phase array
   * @param arr The array to add the specified phase to
   * @param phase The phase to copy and alter
   * @param pause The pause of the new phase (see artillery.io)
   */
  addPause: (arr, phase, pause) => {
    impl.copyOverwritePush(arr, phase, null, null, null, null, pause);
  },
  /**
   * Split the requests per second of a phase to be no more than the given chunkSize.
   * @param phase The phase to split
   * @param chunkSize The maximum number of requests per second to allow in the chunked off phase
   * @returns {*} {{chunk, remainder: *}} The chunk that is at most chunkSize requests per second and the
   * remainder of the pahse.
   */
  splitPhaseByWidth: (phase, chunkSize) => {
    const ret = {
      chunk: [],
      remainder: [],
    };
    let max;
    let min;
    let intersection;
    let rps;
    let arrivalCount;
    if ('rampTo' in phase && 'arrivalRate' in phase && phase.rampTo === phase.arrivalRate) {
      // no actual ramp... :P  Still, be nice and tolerate this for users
      delete phase.rampTo; // eslint-disable-line no-param-reassign
    }
    if ('rampTo' in phase && 'arrivalRate' in phase) { // ramp phase
      max = Math.max(phase.arrivalRate, phase.rampTo);
      min = Math.min(phase.arrivalRate, phase.rampTo);
      if (max <= chunkSize) {
        // the highest portion of the ramp does not exceed the chunkSize, consume the phase and create a pause remainder
        impl.addRamp(ret.chunk, phase, phase.arrivalRate, phase.rampTo, phase.duration);
        impl.addPause(ret.remainder, phase, phase.duration);
      } else if (min >= chunkSize) {
        // the least portion of the ramp exceeds chunkSize, produce a constant arrival and reduce the ramp by chunkSize
        impl.addArrivalRate(ret.chunk, phase, chunkSize, phase.duration);
        impl.addRamp(ret.remainder, phase, phase.arrivalRate - chunkSize, phase.rampTo - chunkSize, phase.duration);
      } else {
        // otherwise, the chunkSize intersects the phase's request per second trajectory, differentially split across
        // the intersection
        // Case 1                 Case 2                  Where
        // y2  |      |    *      y1  | *    |            cs = chunkSize
        //     |   p     r            |  r      p         d  = duration
        // cs  |- - - *- - -      cs  |- - - *- - -       x  = intersection
        //     |   r  |  a            |  a   |  r         y1 = arrivalRate
        // y1  | *                y2  |           *       y2 = rampTo
        //     |      |               |      |            r  = a ramp phase
        //  0 _|____________       0 _|____________       a  = an constant arrival phase
        //     |                      |                   p  = a pause phase
        //     0      x    d         0      x    d        *  = a starting, ending, or intermediate RPS
        intersection = impl.intersection(phase, chunkSize);
        if (phase.arrivalRate < phase.rampTo) {
          impl.addRamp(ret.chunk, phase, phase.arrivalRate, chunkSize, intersection.x);
          impl.addArrivalRate(ret.chunk, phase, chunkSize, phase.duration - intersection.x);
          impl.addPause(ret.remainder, phase, intersection.x);
          impl.addRamp(ret.remainder, phase, 1, phase.rampTo - chunkSize, phase.duration - intersection.x);
        } else {
          impl.addArrivalRate(ret.chunk, phase, chunkSize, intersection.x);
          impl.addRamp(ret.chunk, phase, chunkSize, phase.rampTo, phase.duration - intersection.x);
          impl.addRamp(ret.remainder, phase, phase.arrivalRate - chunkSize, 1, intersection.x);
          impl.addPause(ret.remainder, phase, phase.duration - intersection.x);
        }
      }
    } else if ('arrivalRate' in phase) { // constant rate phase
      if (phase.arrivalRate > chunkSize) { // subtract the chunkSize if greater than that
        impl.addArrivalRate(ret.chunk, phase, chunkSize, phase.duration);
        impl.addArrivalRate(ret.remainder, phase, phase.arrivalRate - chunkSize, phase.duration);
      } else { // Otherwise, include the entire arrival and create a pause for the remainder
        impl.addArrivalRate(ret.chunk, phase, phase.arrivalRate, phase.duration);
        impl.addPause(ret.remainder, phase, phase.duration);
      }
    } else if ('arrivalCount' in phase && 'duration' in phase) {
      // constant rate stated as total scenarios delivered over a duration
      rps = phase.arrivalCount / phase.duration;
      if (rps >= chunkSize) {
        arrivalCount = Math.floor(chunkSize * phase.duration);
        impl.addArrivalCount(ret.chunk, phase, arrivalCount, phase.duration);
        impl.addArrivalCount(ret.remainder, phase, phase.arrivalCount - arrivalCount, phase.duration);
      } else {
        impl.addArrivalCount(ret.chunk, phase, phase.arrivalCount, phase.duration);
        impl.addPause(ret.remainder, phase, phase.duration);
      }
    } else if ('pause' in phase) {
      impl.addPause(ret.chunk, phase, phase.pause);
      impl.addPause(ret.remainder, phase, phase.pause);
    }
    return ret;
  },
  /**
   * Split a script by width because it specifies a requests per second load in excess of chunkSize
   * Split the given script by width since it is too wide to run on a single lambda.  Do this by chunking off
   * the maximum RPS a single lambda can handle.
   * @param script The script to split by width
   * @param chunkSize The maximum width of any phase
   * @returns {{chunk, remainder}} The Lambda-sized chunk that was removed from the script and the remaining
   * script to execute
   */
  splitScriptByWidth: (script, chunkSize) => {
    const ret = {
      chunk: JSON.parse(JSON.stringify(script)),
      remainder: JSON.parse(JSON.stringify(script)),
    };
    let phaseParts;
    let i;
    let j;
    ret.chunk.config.phases = [];
    ret.remainder.config.phases = [];
    for (i = 0; i < script.config.phases.length; i++) {
      phaseParts = impl.splitPhaseByWidth(script.config.phases[i], chunkSize);
      for (j = 0; j < phaseParts.chunk.length; j++) {
        ret.chunk.config.phases.push(phaseParts.chunk[j]);
      }
      for (j = 0; j < phaseParts.remainder.length; j++) {
        ret.remainder.config.phases.push(phaseParts.remainder[j]);
      }
    }
    return ret;
  },
  /**
   * After executing the first job of a long running load test, wait the requested time delay before sending the
   * remaining jobs to a new Lambda for execution
   * @param timeDelay The amount of time to delay before sending the remaining jobs for execution
   * @param event The event containing the remaining jobs that is to be sent to the next Lambda
   * @param context The Lambda context for the job
   * @param callback The callback to notify errors and successful execution to
   */
  invokeSelf(timeDelay, event, context, callback) {
    let params;
    let exec;
    let msg;
    try {
      params = {
        FunctionName: context.functionName,
        InvocationType: 'Event',
        Payload: JSON.stringify(event),
      };
      if (process.env.SERVERLESS_STAGE) {
        params.FunctionName += `:${process.env.SERVERLESS_STAGE}`;
      }
      exec = () => {
        if (event._simulation) {
          console.log('SIMULATION: self invocation.');
          impl.run(Date.now(), event, simulation.context, simulation.callback);
        } else {
          lambda.invoke(params, (err) => {
            if (err) {
              throw new Error(`ERROR invoking self: ${err}`);
            }
          });
        }
        callback();
      };
      if (timeDelay > 0) {
        setTimeout(exec, timeDelay);
        if (event._trace) {
          console.log(
            `scheduling self invocation for ${event._genesis} in ${event._start} with a ${timeDelay} ms delay`
          );
        }
      } else {
        exec();
      }
    } catch (ex) {
      msg = `ERROR exception encountered while invoking self from ${event._genesis} ` +
        `in ${event._start}: ${ex.message}\n${ex.stack}`;
      console.log(msg);
      callback(msg);
    }
  },
  /**
   * Reads the playload data from the test script.
   * @param script - Script that defines the payload to be read.
   */
  readPayload(script) {
    let ret;
    const determinePayloadPath = payloadFile => path.resolve(process.cwd(), payloadFile);
    const readSinglePayload = (payloadObject) => {
      const payloadPath = determinePayloadPath(payloadObject.path);
      const data = fs.readFileSync(payloadPath, 'utf-8');
      return csv(data);
    };
    if (script && script.config && script.config.payload) {
      // There's some kind of payload, so process it.
      if (Array.isArray(script.config.payload)) {
        ret = JSON.parse(JSON.stringify(script.config.payload));
        // Multiple payloads to load, loop through and load each.
        script.config.payload.forEach((payload, i) => {
          ret[i].data = readSinglePayload(payload);
        });
      } else if (typeof script.config.payload === 'object') {
        // Just load the one playload
        ret = readSinglePayload(script.config.payload);
      } else {
        console.log('WARNING: payload file not set, but payload is configured.\n');
      }
    }
    return ret;
  },
  // event is bare Artillery script
  /**
   * Run a load test given an Artillery script and report the results
   * @param start The time that invocation began
   * @param script The artillery script
   * @param context The Lambda context for the job
   * @param callback The callback to report errors and load test results to
   */
  runLoad: (start, script, context, callback) => {
    let runner;
    let payload;
    let msg;
    if (script._trace) {
      console.log(`runLoad started from ${script._genesis} @ ${start}`);
    }
    if (script._simulation) {
      console.log(`SIMULATION: runLoad called with ${JSON.stringify(script, null, 2)}`);
    } else {
      try {
        impl.loadProcessor(script);
        payload = impl.readPayload(script);
        runner = artillery.runner(script, payload, {});
        runner.on('phaseStarted', (opts) => {
          console.log(
            'phase',
            opts.index,
            ':',
            opts.name ? opts.name : '',
            'started, duration',
            opts.duration ? opts.duration : opts.pause
          );
        });
        runner.on('phaseCompleted', (opts) => {
          console.log('phase', opts.index, ':', opts.name ? opts.name : '', 'complete');
        });
        runner.on('done', (report) => {
          const latencies = report.latencies;
          report.latencies = undefined; // eslint-disable-line no-param-reassign
          console.log(JSON.stringify(report, null, 2));
          report.latencies = latencies; // eslint-disable-line no-param-reassign
          callback(null, report);
          if (script._trace) {
            console.log(`runLoad stopped from ${script._genesis} in ${start} @ ${Date.now()}`);
          }
        });
        runner.run();
      } catch (ex) {
        msg = `ERROR exception encountered while executing load from ${script._genesis} ` +
          `in ${start}: ${ex.message}\n${ex.stack}`;
        console.log(msg);
        callback(msg);
      }
    }
  },
  /**
   * Loads custom processor functions from artillery configuration
   * @param script The Artillery (http://artillery.io) script to be executed
   */
  loadProcessor: (script) => {
    const config = script.config;
    if (config.processor && typeof config.processor === 'string') {
      const processorPath = path.resolve(process.cwd(), config.processor);
      config.processor = require(processorPath); // eslint-disable-line global-require,import/no-dynamic-require
    }
  },
  /**
   * Run an Artillery script.  Detect if it needs to be split and do so if it does.  Execute scripts not requiring
   * splitting.
   *
   * Customizable script splitting settings can be provided in an optional "_split" attribute, an example of which
   * follows:
   *  {
   *      maxScriptDurationInSeconds: 86400,  // max value - see constants.DEFAULT_MAX_SCRIPT_DURATION_IN_SECONDS
   *      maxScriptRequestsPerSecond: 5000,   // max value - see constants.DEFAULT_MAX_SCRIPT_REQUESTS_PER_SECOND
   *      maxChunkDurationInSeconds: 240,     // max value - see constants.DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS
   *      maxChunkRequestsPerSecond: 25,      // max value - see constants.DEFAULT_MAX_CHUNK_REQUESTS_PER_SECOND
   *      timeBufferInMilliseconds: 15000,    // default   - see constants.DEFAULT_MAX_TIME_BUFFER_IN_MILLISECONDS
   *  }
   *
   * TODO What if there is not external reporting for a script that requires splitting?  Detect this and error out?
   *
   * @param timeNow The time at which the event was received for this execution
   * @param script The Artillery (http://artillery.io) script execute after optional splitting
   * @param context The Lambda provided execution context
   * @param callback The Lambda provided callback to report errors or success to
   */
  run: (timeNow, script, context, callback) => {
    let settings;
    let scriptDuration;
    let scriptWidth;
    let parts;
    let toComplete;
    let complete;
    let timeDelay;
    let exec;
    if (impl.validScript(script, context, callback)) {
      settings = impl.getSettings(script);
      scriptDuration = impl.scriptLength(script);
      scriptWidth = impl.scriptWidth(script);
      toComplete = 1;
      console.log(`toComplete: ${toComplete} in ${timeNow} (init)`);
      complete = () => {
        toComplete -= 1;
        if (toComplete > 0) { // do we have more outstanding asynchronous operations/callbacks to execute?
          if (script._trace) {
            console.log(`load test from ${script._genesis} executed by ${timeNow} partially complete @ ${Date.now()}`);
          }
        } else { // otherwise, time to complete the lambda
          callback(null, {
            message: `load test from ${script._genesis} successfully completed from ${timeNow} @ ${Date.now()}`,
          });
          if (script._trace) {
            console.log(`load test from ${script._genesis} in ${timeNow} completed @ ${Date.now()}`);
          }
        }
      };
      if (!script._genesis) {
        script._genesis = timeNow; // eslint-disable-line no-param-reassign
      }
      // if there is more script to execute than we're willing to execute in a single chunk, chomp off a
      // chunk, execute and create an extension.
      if (scriptDuration > settings.maxChunkDurationInSeconds) {
        if (script._trace) {
          console.log(`splitting script by length from ${script._genesis} in ${timeNow} @ ${Date.now()}`);
        }
        toComplete = 2;
        parts = impl.splitScriptByLength(script, settings.maxChunkDurationInSeconds);
        if (!parts.chunk._start) {
          parts.chunk._start = timeNow + settings.timeBufferInMilliseconds;
        }
        // kick the reminder off timeBufferInMilliseconds ms before the end of the chunk's completion
        parts.remainder._start = parts.chunk._start + (settings.maxChunkDurationInSeconds * 1000);
        scriptWidth = impl.scriptWidth(parts.chunk);
        if (script._trace) {
          console.log(`scheduling shortened chunk start from ${
            script._genesis} in ${timeNow} for execution @ ${parts.chunk._start}`);
        }
        if (scriptWidth > settings.maxChunkRequestsPerSecond) { // needs splitting by width too
          impl.run(timeNow, parts.chunk, context, complete);
        } else { // otherwise, send to a separate lambda for execution
          impl.invokeSelf(
            (parts.chunk._start - Date.now()) - settings.timeBufferInMilliseconds, parts.chunk, context, complete
          );
        }
        // now scheduling elongation
        if (script._trace) {
          console.log(
            `scheduling remainder start from ${script._genesis} in ${timeNow} for execution @ ${parts.remainder._start}`
          );
        }
        impl.invokeSelf(
          parts.remainder._start - Date.now() - settings.timeBufferInMilliseconds, parts.remainder, context, complete
        );
        // otherwise, if the script is too wide for a single Lambda to execute, chunk off executable chunks and
        // send them to Lambdas for execution
      } else if (scriptWidth > settings.maxChunkRequestsPerSecond) {
        if (script._trace) {
          console.log(`splitting script by width from ${script._genesis} in ${timeNow} @ ${Date.now()}`);
        }
        if (!script._start) {
          script._start = timeNow + settings.timeBufferInMilliseconds; // eslint-disable-line no-param-reassign
        }
        toComplete = Math.ceil(scriptWidth / settings.maxChunkRequestsPerSecond);
        do {
          parts = impl.splitScriptByWidth(script, settings.maxChunkRequestsPerSecond);
          console.log(JSON.stringify(parts.chunk, null, 2));
          // send the chunk
          impl.invokeSelf(
            parts.chunk._start - Date.now() - settings.timeBufferInMilliseconds, parts.chunk, context, complete
          );
          // determine whether we need to continue chunking
          script = parts.remainder; // eslint-disable-line no-param-reassign
          scriptWidth = impl.scriptWidth(script);
        } while (scriptWidth > 0);
      } else {
        if (!script._start) {
          script._start = timeNow; // eslint-disable-line no-param-reassign
        }
        timeDelay = script._start - Date.now();
        exec = () => {
          if (script._trace) {
            console.log(`executing load script from ${script._genesis} in ${timeNow} @ ${Date.now()}`);
          }
          impl.runLoad(timeNow, script, context, callback);
        };
        if (timeDelay > 0) {
          setTimeout(exec, timeDelay);
          if (script._trace) {
            console.log(`scheduling load execution from ${script._genesis} in ${
              timeNow} with a ${timeDelay} ms delay @ ${Date.now()}`);
          }
        } else {
          exec();
        }
      }
    }
  },
};
const api = {
  /**
   * This Lambda produces load according to the given specification.
   * If that load exceeds the limits that a Lambda can individually satisfy (duration or requests per second) then
   * the script will be split into chunks that can be executed by single lambdas and those will be executed.  If
   * the script can be run within a single Lambda then the results of that execution will be returned as the
   * result of the lambda invocation.
   * @param event The event specifying an Artillery load generation test to perform
   * @param context The Lambda context for the job
   * @param callback The Lambda callback to notify errors and results to
   */
  run: (event, context, callback) => {
    impl.run(Date.now(), event, context, callback);
  },
};

module.exports = {
  handler: api.run,
};
