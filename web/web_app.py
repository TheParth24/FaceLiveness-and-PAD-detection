from flask import Flask, render_template, request, jsonify
from web_backend import WebLivenessEngine, decode_frame

app = Flask(__name__)

engines = {}


def get_engine(role, name):

    key = role + ":" + name

    if key not in engines:

        engines[key] = WebLivenessEngine(
            role=role,
            name=name
        )

    return engines[key]


@app.route("/")
def home():

    return render_template(
        "index.html"
    )


@app.route("/api/start", methods=["POST"])
def start():

    data = request.get_json()

    role = data.get(
        "role",
        "resident"
    )

    name = data.get(
        "name",
        ""
    ).strip()

    if not name and role != "resident":
        return jsonify({
            "success": False,
            "message": "Name required"
        })

    key = role + ":" + name

    if key in engines:

        engines[key].close()
        del engines[key]

    try:

        engine = get_engine(
            role,
            name
        )

        return jsonify({
            "success": True,
            "message": "Verification started",
            "role": role,
            "name": name
        })

    except Exception as e:

        return jsonify({
            "success": False,
            "message": str(e)
        })


@app.route("/api/frame", methods=["POST"])
def frame():

    data = request.get_json()

    role = data.get(
        "role",
        "resident"
    )

    name = data.get(
        "name",
        ""
    ).strip()

    image = data.get(
        "image"
    )

    if not image:

        return jsonify({
            "success": False,
            "message": "Frame missing"
        })

    try:

        engine = get_engine(
            role,
            name
        )

        frame_data = decode_frame(
            image
        )

        if frame_data is None:

            return jsonify({
                "success": False,
                "message": "Invalid frame"
            })

        result = engine.process_frame(
            frame_data
        )

        return jsonify({
            "success": True,
            "result": result
        })

    except Exception as e:

        return jsonify({
            "success": False,
            "message": str(e)
        })


@app.route("/api/register", methods=["POST"])
def register():

    data = request.get_json()

    name = data.get(
        "name",
        ""
    ).strip()

    image = data.get(
        "image"
    )

    if not name:

        return jsonify({
            "success": False,
            "message": "Resident name required"
        })

    if not image:

        return jsonify({
            "success": False,
            "message": "Face image required"
        })

    try:

        engine = get_engine(
            "resident",
            name
        )

        frame_data = decode_frame(
            image
        )

        if frame_data is None:

            return jsonify({
                "success": False,
                "message": "Invalid image"
            })

        result = engine.process_frame(
            frame_data
        )

        if result["final"] != "LIVE":

            return jsonify({
                "success": False,
                "message": "Liveness verification not completed",
                "result": result
            })

        success, message = (
            engine.register_resident(
                frame_data
            )
        )

        return jsonify({
            "success": success,
            "message": message,
            "result": result
        })

    except Exception as e:

        return jsonify({
            "success": False,
            "message": str(e)
        })


@app.route("/api/reset", methods=["POST"])
def reset():

    data = request.get_json()

    role = data.get(
        "role",
        "resident"
    )

    name = data.get(
        "name",
        ""
    ).strip()

    key = role + ":" + name

    if key in engines:

        engines[key].close()

        del engines[key]

    return jsonify({
        "success": True
    })


@app.route("/api/challenge", methods=["POST"])
def challenge():

    data = request.get_json()

    role = data.get(
        "role",
        "resident"
    )

    name = data.get(
        "name",
        ""
    ).strip()

    engine = get_engine(
        role,
        name
    )

    engine.next_challenge()

    return jsonify({
        "success": True,
        "challenge": engine.challenge
    })


@app.route("/api/users")
def users():

    import os

    result = []

    if os.path.exists(
        "data/users"
    ):

        for name in os.listdir(
            "data/users"
        ):

            folder = os.path.join(
                "data/users",
                name
            )

            if os.path.isdir(folder):

                result.append(name)

    return jsonify({
        "success": True,
        "users": sorted(result)
    })


@app.route("/api/shutdown")
def shutdown():

    for engine in engines.values():

        engine.close()

    engines.clear()

    return jsonify({
        "success": True
    })


if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False,
        threaded=True
    )