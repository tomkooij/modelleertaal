window.onload = function() {
		var fileInput = document.getElementById('fileInput');
		var fileOutput = document.getElementById('bestandInhoud');

		fileInput.addEventListener('change', function(e) {
			var file = fileInput.files[0];
			var textType = /text.*/;

			if (file.type.match(textType)) {
				var reader = new FileReader();

				reader.onload = function(e) {
					fileOutput.innerText = reader.result;
				};

				reader.readAsText(file);
			} else {
				fileOuput.innerText = "File not supported!";
			}
		});
};
