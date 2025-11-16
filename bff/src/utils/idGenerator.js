const randomSlice = () => Math.random().toString(36).slice(2, 10);

const makeId = (prefix) => `${prefix}_${randomSlice()}_${Date.now()}`;

module.exports = {
  makeId
};
