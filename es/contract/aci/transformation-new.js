import { readType, SOPHIA_TYPES } from './transformation'
import {
  validate,
  isNumber,
  isString,
  isList, isAddress,
  isBoolean, isTuple, isHash, isSignature, isBytes
} from '../../utils/schema-validator'

export function prepareSchemaNew (index, type, { bindings } = {}) {
  let { t, generic } = readType(type, { bindings })
  if (!Object.keys(SOPHIA_TYPES).includes(t)) t = SOPHIA_TYPES.address // Handle Contract address transformation
  switch (t) {
    case SOPHIA_TYPES.int:
      return isNumber(index)
    case SOPHIA_TYPES.string:
      return isString(index)
    case SOPHIA_TYPES.list:
      return isList(index, generic, bindings)
    case SOPHIA_TYPES.address:
      return isAddress(index)
    case SOPHIA_TYPES.bool:
      return isBoolean(index)
    case SOPHIA_TYPES.tuple:
      return isTuple(index, generic, bindings)
    case SOPHIA_TYPES.hash:
      return isHash(index)
    case SOPHIA_TYPES.signature:
      return isSignature(index)
    case SOPHIA_TYPES.bytes:
      return isBytes(index, generic)
    default:
      return function (value) {
        return {hasError: false}
      }
  }
}

export function validateArgumentsNew (aci, params) {
  const modelBlueprint = {}
  aci.arguments.forEach(({ type }, i) => {
    modelBlueprint[i] = prepareSchemaNew(i, type, { bindings: aci.bindings })
  })
  validate(params, modelBlueprint)
}
