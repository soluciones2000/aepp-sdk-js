import { prepareSchemaNew } from '../contract/aci/transformation-new'

export function isNumber (index) {
  return function(value) {
    if (!isNaN(value)) {
      return successResponse()
    }
    return errorResponse(`Argument at position ${index} fails because it is not a number`)
  }
}

export function isString (index) {
  return function (value) {
    if (typeof value === 'string') {
      return successResponse()
    }
    return errorResponse(`Argument at position ${index} fails because it is not a string`)
  }
}

export function isList (index, generic, bindings) {
  return function(value) {
    if (Array.isArray(value)) {
      if (new Set( value.map( x => typeof x ) ).size <= 1) {
        return value.map((el, i) => prepareSchemaNew(i, generic, { bindings }))
      } else {
        return errorResponse(`Argument at position ${index} fails because list is not a homogenous one`)
      }
    } else {
      return errorResponse(`Argument at position ${index} fails because it is not an array`)
    }
  }
}

export function isAddress (index) {
  return function(value) {
    if (typeof value !== 'string') {
      return errorResponse(`Argument at position ${index} fails because it is not a string`)
    } else if (!/^(ak_|ct_|ok_|oq_)/m.test(value)) {
      return errorResponse(`Argument at position ${index} fails because it does not match the required pattern: /^(ak_|ct_|ok_|oq_)/`)
    } else {
      return successResponse()
    }
  }
}

export function isBoolean (index) {
  return function(value) {
    if (typeof value === 'boolean') {
      return successResponse()
    } else {
      return successResponse(`Argument at position ${index} fails because it is not a boolean`)
    }
  }
}

export function isTuple (index, generic, bindings) {
  return function(value) {
    if (Array.isArray(value)) {
      if (value.length < generic.length) {
        return errorResponse(`Argument at position ${index} fails because required value is missing (invalid tuple size)`)
      }
      return generic.map((val, idx) => prepareSchemaNew(idx, val, { bindings }))
    } else {
      return errorResponse(`Argument at position ${index} fails because it is not an array`)
    }
  }
}

export function isHash (index) {
  return function (value) {
    return validateBinaryType(value, index, 32)
  }
}

export function isSignature (index) {
  return function (value) {
    return validateBinaryType(value, index, 64)
  }
}

export function isBytes (index, generic) {
  return function (value) {
    return validateBinaryType(value, index, generic)
  }
}

function validateBinaryType(value, index, size) {
  const convertedValue = typeof value === 'string' ? Buffer.from(value, 'hex') : Buffer.from(value)
  if (!Buffer.isBuffer(convertedValue) || convertedValue.length !== size) {
    return errorResponse(`Value '${Buffer.from(value).toString('hex')}' at path: [${index}] not a ${size} bytes`)
  }
  return successResponse()
}

export function validate(object, schema) {
  Object.keys(schema).forEach(function (key) {
    const objectElement = object[key]
    const result = schema[key](objectElement)
    if (Array.isArray(result)) {
      runValidation(result, objectElement)
    } else {
      if (result.hasError) {
        throw new Error(result.message)
      }
    }
  })
}

function runValidation (result, object) {
  result.forEach((el, index) => {
    if (typeof el === 'function') {
      const el1 = el(object[index])
      if (Array.isArray(el1)) {
        runValidation(el1, object[index])
      } else {
        if (el1.hasError) {
          throw new Error(el1.message)
        }
      }
    }
  })
}

export function successResponse() {
  return { hasError: false }
}

export function errorResponse(msg) {
  return {
    hasError: true,
    message: msg
  }
}
