import mongoose from "mongoose";

export default function checkId(resourceLabel = "resource", paramName = "id") {
  return function validateObjectIdParam(request, response, next) {
    const rawId = request.params[paramName];
    if (!mongoose.isValidObjectId(rawId)) {
      return response
        .status(400)
        .json({ message: `Invalid ${resourceLabel} ID.` });
    }
    return next();
  };
}
