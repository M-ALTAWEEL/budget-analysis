"""Machine learning built from scratch: categorizing expense descriptions.

- text.py         normalizing text and turning it into features
- naive_bayes.py  the first model (counts)
- logistic.py     the model the API uses: softmax regression, trained in ml/train_categorizer.py
- explain.py      which words made the model choose a category

Pure Python on purpose: the API needs no numpy or scikit-learn to use the model.
scikit-learn is only used in ml/notebooks/ to compare against and check our code.
"""
