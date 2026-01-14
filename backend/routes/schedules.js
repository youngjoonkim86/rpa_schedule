const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');

// GET /api/schedules - 일정 조회
router.get('/', scheduleController.getSchedules);

// POST /api/schedules - 일정 생성
router.post('/', scheduleController.createSchedule);

// PUT /api/schedules/:id - 일정 수정
router.put('/:id', scheduleController.updateSchedule);

// DELETE /api/schedules/:id - 일정 삭제
router.delete('/:id', scheduleController.deleteSchedule);

module.exports = router;


