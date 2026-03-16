import json
import os
import random
import string

def generate_id(length=16):
    """Generates a random alphanumeric ID."""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def format_time(total_seconds):
    """Converts total seconds into MM:SS format."""
    minutes = total_seconds // 60
    seconds = total_seconds % 60
    return f"{minutes:02d}:{seconds:02d}"

def create_action(start_seconds, end_seconds, method_type, function_name, **kwargs):
    """Creates a single action dictionary with time calculation."""
    action = {
        "id": "mig" + generate_id(),
        "startTime": format_time(start_seconds),
        "endTime": format_time(end_seconds),
        "StartTimeoutId": None,
        "StopTimeoutId": None,
        "methods": {
            method_type: {
                "function": function_name,
                **kwargs
            }
        }
    }
    return action

def create_component(name, actions, connected=False):
    """Creates a component dictionary."""
    return {
        "name": name,
        "connected": connected,
        "actions": actions
    }

def main():
    output_dir = "timelines"
    output_file = os.path.join(output_dir, "timeline.json")

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    motor_actions = []
    base_lamp_actions = []
    
    current_time = 0
    cycles = 100

    for i in range(cycles):
        # --- 1. Motor spins for 7s at 300 RPM, then 3s at 0 RPM ---
        motor_actions.append(create_action(current_time, current_time + 7, "write", "set_rpm", startData="rpm 300", stopData="rpm 0"))
        current_time += 7

        motor_actions.append(create_action(current_time, current_time + 3, "write", "set_rpm", startData="rpm 0", stopData="rpm 0"))
        current_time += 3

        # --- 2. Move to and stay for 5s at 152° (Detect Well 1) ---
        motor_actions.append(create_action(current_time, current_time + 5, "write", "set_deg", startData="deg 266", stopData="deg 266"))
        base_lamp_actions.append(create_action(current_time, current_time + 5, "write", "well", startData="well 1", stopData="well 0"))
        current_time += 5

        # --- 3. Move to and stay for 5s at 124° (Detect Well 2) ---
        motor_actions.append(create_action(current_time, current_time + 5, "write", "set_deg", startData="deg 296", stopData="deg 296"))
        base_lamp_actions.append(create_action(current_time, current_time + 5, "write", "well", startData="well 2", stopData="well 0"))
        current_time += 5

        # --- 4. Move to and stay for 5s at 94° (Detect Well 3) ---
        motor_actions.append(create_action(current_time, current_time + 5, "write", "set_deg", startData="deg 328", stopData="deg 328"))
        base_lamp_actions.append(create_action(current_time, current_time + 5, "write", "well", startData="well 3", stopData="well 0"))
        current_time += 5

        # --- 5. Move to and stay for 5s at 94° (Detect Well 3) ---
        motor_actions.append(create_action(current_time, current_time + 5, "write", "set_deg", startData="deg 358", stopData="deg 358"))
        base_lamp_actions.append(create_action(current_time, current_time + 5, "write", "well", startData="well 4", stopData="well 0"))
        current_time += 5

    # Global Read Action for BaseLAMP (covers the entire duration)
    base_lamp_actions.append(
        create_action(0, current_time, "read", "read_colors", 
                      format="w1 w2 w3 w4 w5 w6 w7 w8 w9 w10 w11 w12", 
                      screen="1")
    )

    components = [
        create_component("Motor", motor_actions),
        create_component("BaseLAMP", base_lamp_actions),
        create_component("SpinnerLAMP", [])
    ]

    with open(output_file, "w") as f:
        json.dump(components, f, indent=2)

    print(f"Timeline generated with {cycles} cycles. Total duration: {format_time(current_time)}")

if __name__ == "__main__":
    main()