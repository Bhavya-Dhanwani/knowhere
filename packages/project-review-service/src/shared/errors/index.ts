import ApiError from '../utils/ApiError.util.js';
import HTTP_STATUS from '../constants/StatusCodes.constants.js';

export class BadRequest extends ApiError {
  constructor(message: string = 'Bad Request') {
    super(HTTP_STATUS.BAD_REQUEST, message);
  }
}

export class NotFound extends ApiError {
  constructor(message: string = 'Resource Not Found') {
    super(HTTP_STATUS.NOT_FOUND, message);
  }
}

export class Forbidden extends ApiError {
  constructor(message: string = 'Forbidden') {
    super(HTTP_STATUS.FORBIDDEN, message);
  }
}

export class Conflict extends ApiError {
  constructor(message: string = 'Resource Conflict') {
    super(HTTP_STATUS.CONFLICT, message);
  }
}

export class Unauthorized extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super(HTTP_STATUS.UNAUTHORIZED, message);
  }
}

export default {
  BadRequest,
  NotFound,
  Forbidden,
  Conflict,
  Unauthorized
};
