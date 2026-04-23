package webpush

import (
	"errors"
	"sync/atomic"
)

type Task func() error

type QueueSnapshot struct {
	Pending     int64 `json:"pending"`
	Running     int64 `json:"running"`
	Concurrency int   `json:"concurrency"`
}

type Queue struct {
	concurrency int
	ch          chan Task

	pending int64
	running int64
}

func NewQueue(concurrency, buffer int) *Queue {
	if concurrency <= 0 {
		concurrency = 10
	}
	if buffer <= 0 {
		buffer = 1000
	}
	q := &Queue{
		concurrency: concurrency,
		ch:          make(chan Task, buffer),
	}
	for i := 0; i < concurrency; i++ {
		go q.worker()
	}
	return q
}

func (q *Queue) Enqueue(task Task) error {
	if task == nil {
		return errors.New("nil task")
	}
	select {
	case q.ch <- task:
		atomic.AddInt64(&q.pending, 1)
		return nil
	default:
		return errors.New("queue is full")
	}
}

func (q *Queue) Snapshot() QueueSnapshot {
	return QueueSnapshot{
		Pending:     atomic.LoadInt64(&q.pending),
		Running:     atomic.LoadInt64(&q.running),
		Concurrency: q.concurrency,
	}
}

func (q *Queue) worker() {
	for task := range q.ch {
		atomic.AddInt64(&q.pending, -1)
		atomic.AddInt64(&q.running, 1)
		_ = task()
		atomic.AddInt64(&q.running, -1)
	}
}

