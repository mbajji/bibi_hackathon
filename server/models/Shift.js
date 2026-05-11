import mongoose from 'mongoose';

const VALID_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const shiftSchema = new mongoose.Schema(
  {
    employeeId: { type: Number, required: true },
    employeeName: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    day: { type: String, required: true, enum: VALID_DAYS },
    start: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    end: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    status: { type: String, default: 'scheduled' },
  },
  { timestamps: true }
);

shiftSchema.index({ day: 1, start: 1 });

export const Shift = mongoose.model('Shift', shiftSchema);
export { VALID_DAYS };
