import { Router } from "express";

const router = Router();

router.get("/", (request, response) => {
  response.json(request.app.locals.requestStats);
});

export default router;
