const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

// GET /api/people
router.get('/', async (req, res) => {
  try {
    const db = await getDbConnection();
    const people = await db.all('SELECT * FROM people ORDER BY name ASC');
    res.json(people);
  } catch (error) {
    console.error('Error fetching people:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/people
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const id = `person-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const createdAt = new Date().toISOString();

  try {
    const db = await getDbConnection();
    await db.run(
      'INSERT INTO people (id, name, created_at) VALUES (?, ?, ?)',
      [id, name, createdAt]
    );
    const person = await db.get('SELECT * FROM people WHERE id = ?', [id]);
    res.status(201).json(person);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Person with this name already exists' });
    }
    console.error('Error creating person:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/people/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const db = await getDbConnection();
    await db.run('UPDATE people SET name = ? WHERE id = ?', [name, id]);
    const person = await db.get('SELECT * FROM people WHERE id = ?', [id]);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    res.json(person);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Person with this name already exists' });
    }
    console.error('Error updating person:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/people/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const result = await db.run('DELETE FROM people WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }
    res.json({ message: 'Person deleted successfully' });
  } catch (error) {
    console.error('Error deleting person:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
