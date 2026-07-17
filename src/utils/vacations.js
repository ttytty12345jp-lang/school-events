// dateKey が長期休み期間（夏休み・冬休みなど）に含まれるか
export function isInVacation(dateKey, vacations = []) {
  return vacations.some(v => v.start && v.end && dateKey >= v.start && dateKey <= v.end)
}
