import {
  hasIn,
  isString,
} from 'lodash-es'

export function parseError(msgToShow: any, title?: string): [string, string | undefined] {
  const paramsToPass: { title: string, message: string } = {
    title: '',
    message: '',
  }

  if (isString(title)) {
    paramsToPass.title = title
  }

  if (isString(msgToShow)) {
    paramsToPass.message = msgToShow
  }
  else if (hasIn(msgToShow, 'response.data.message')) {
    paramsToPass.message = `${msgToShow.response.data.message} (Code: ${msgToShow.response.data.code})`
  }
  else if (hasIn(msgToShow, 'message')) {
    paramsToPass.message = msgToShow.message
  }
  else {
    paramsToPass.message = JSON.stringify(msgToShow)
  }

  return [paramsToPass.message, paramsToPass.title]
}
