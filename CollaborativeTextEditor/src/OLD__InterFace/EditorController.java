package OLD__InterFace;

import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.input.MouseEvent;

public class EditorController {
	private MouseEvent mouseEvent;
	private KeyEvent keyEvent;

	public EditorController(KeyEvent kEvent) {
		this.keyEvent = kEvent;
		doKeyEvent();
	}

	public EditorController(MouseEvent mEvent) {
		this.mouseEvent = mEvent;
		doMouseEvent();
	}

	private void doKeyEvent() {
		String type = keyEvent.getEventType().getName();
		KeyCode kCode = keyEvent.getCode();

		System.out.println("\ttyped: [" + type + "] Code: [" + kCode + "]");
	}

	private void doMouseEvent() {
		String source = mouseEvent.getSource().getClass().getSimpleName();
		String target = mouseEvent.getTarget().getClass().getSimpleName();

		// get mouse x and y position relative to scene
		double sourceSceX = mouseEvent.getSceneX();
		double targetSceY = mouseEvent.getSceneY();

		// get mouse x and y position relative to screen
		// double sourceScrX = mouseEvent.getScreenX();
		// double targetScrY = mouseEvent.getScreenY();

		// System.out.println("type: [" + mouseEvent.getButton().name() + "] source: [" + source + "] target: [" + target + "]  sourceSceX: [" + sourceSceX + "] targetSceY: [" + targetSceY + "]" + "sourceScrX: [" + sourceScrX + "] targetScrY: [" + targetScrY + "]");
		System.out.println("type: [" + mouseEvent.getButton().name() + "] source: [" + source + "] target: [" + target + "]  sourceSceX: [" + sourceSceX + "] targetSceY: [" + targetSceY + "]");

	}
}
